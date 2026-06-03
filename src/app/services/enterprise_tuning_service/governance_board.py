"""Multi-Agent SQL Governance Board.

A lightweight supervisor/specialist multi-agent orchestrator that coordinates the
project's existing domain experts into a single consolidated review:

    Supervisor (汇总裁决)
      ├── PerformanceAgent  -> SQLTuner       (瓶颈分析 / 重写 / 索引)
      ├── SecurityAgent     -> PrivacyAuditor (PII 泄露 / 合规)
      ├── AntiPatternAgent  -> static rules + LLM (反模式静态+语义审查)
      └── SandboxAgent      -> SQLTuningHarness (事务沙盒实测, 可选)

Design choices (see ENHANCEMENT_PLAN.md):
- Reuses the project's existing specialist components rather than re-implementing
  domain logic or pulling in a heavyweight research framework (MATS/MageSQL need
  GPU/VLLM and target leaderboard benchmarks — overkill here).
- Independent specialist agents run concurrently; the Supervisor aggregates their
  verdicts (deterministic risk math + an LLM-authored Chinese consensus narrative).
- Every agent degrades gracefully: a failing specialist never aborts the board.
"""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from src.utils.logging import get_logger
from ..text2sql_lg_service.llm_client import LLMClient
from .sql_tuner import SQLTuner
from .privacy_auditor import PrivacyAuditor
from .evaluation_harness import SQLTuningHarness

logger = get_logger(__name__)


# Severity weights used for deterministic, explainable risk scoring.
_SEVERITY_WEIGHT = {"HIGH": 25, "MEDIUM": 12, "LOW": 5}


class SpecialistVerdict(BaseModel):
    """A single specialist agent's contribution to the board review."""

    agent: str = Field(..., description="Machine name of the agent")
    role: str = Field(..., description="Human readable Chinese role title")
    status: str = Field(..., description="ok | skipped | error")
    headline: str = Field(..., description="One-line Chinese verdict from this agent")
    risk_contribution: int = Field(0, description="0-100 risk contributed by this agent")
    findings: List[str] = Field(default_factory=list, description="Key findings (Chinese)")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Raw structured output")


class GovernanceReport(BaseModel):
    """Consolidated multi-agent review report."""

    overall_verdict: str = Field(..., description="APPROVED | APPROVED_WITH_CHANGES | BLOCKED")
    overall_risk_score: int = Field(..., description="0 (safe) - 100 (critical)")
    consensus_summary: str = Field(..., description="Supervisor's Chinese narrative")
    recommended_sql: str = Field(..., description="Best optimized SQL the board endorses")
    action_items: List[str] = Field(default_factory=list, description="Prioritized Chinese to-dos")
    specialist_verdicts: List[SpecialistVerdict] = Field(default_factory=list)


# Static anti-pattern rules (kept self-contained so the board has no API-layer deps).
def _static_anti_patterns(sql: str) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    if re.search(r"SELECT\s+\*\s+FROM", sql, re.IGNORECASE):
        issues.append({
            "rule": "SELECT * 反模式",
            "severity": "MEDIUM",
            "description": "使用 SELECT * 会加载多余列，增大 I/O 并使覆盖索引失效，建议显式列出字段。",
        })
    if sql.upper().lstrip().startswith("SELECT") and not re.search(r"\bLIMIT\b", sql, re.IGNORECASE):
        issues.append({
            "rule": "缺少分页限制 LIMIT",
            "severity": "HIGH",
            "description": "缺少 LIMIT，在大表上可能返回海量行，污染 Buffer Pool 并引发 OOM，建议强制分页。",
        })
    if re.search(r"LIKE\s+['\"]%", sql, re.IGNORECASE):
        issues.append({
            "rule": "前缀模糊查询 LIKE '%...'",
            "severity": "HIGH",
            "description": "前置通配符导致 B-Tree 索引失效、全表扫描，建议改用全文检索或调整匹配策略。",
        })
    if re.search(r"\bFOR\s+UPDATE\b|\bLOCK\b", sql, re.IGNORECASE):
        issues.append({
            "rule": "显式排他锁隐患",
            "severity": "HIGH",
            "description": "FOR UPDATE/显式锁在高并发下易造成事务阻塞与死锁，建议高精度走索引并设置 NOWAIT/超时。",
        })
    head = sql.split("WHERE")[0] if "WHERE" in sql.upper() else ""
    if re.search(r"CROSS\s+JOIN", sql, re.IGNORECASE) or ("," in head and re.search(r"\bFROM\b", head, re.IGNORECASE)):
        issues.append({
            "rule": "潜在笛卡尔积关联",
            "severity": "HIGH",
            "description": "隐式逗号关联或 CROSS JOIN 若缺少 ON 连接键会产生笛卡尔积，建议改写为 INNER JOIN ... ON。",
        })
    return issues


class SQLGovernanceBoard:
    """Supervisor coordinating specialist agents into one consolidated SQL review."""

    SUPERVISOR_SYSTEM_PROMPT = """
    你是企业数据库治理委员会的「首席主审官 (Supervisor)」。下属四个专家智能体分别从
    [性能调优]、[数据安全与合规]、[SQL 反模式]、[沙盒实测] 角度给出了对一条 SQL 的评审意见。
    你的职责是：综合所有专家意见，给出最终裁决与可执行的整改清单。

    你必须只返回一个严格的 JSON 对象（不要 markdown 代码块、不要多余解释），字段如下：
    {
        "overall_verdict": "APPROVED | APPROVED_WITH_CHANGES | BLOCKED 三选一",
        "consensus_summary": "用中文写 2-4 句话的委员会综合裁决说明，点明核心风险与亮点",
        "action_items": ["用中文写的、按优先级排序的整改建议", "..."]
    }
    裁决标准：存在 HIGH 安全/合规风险或高风险反模式时倾向 BLOCKED；仅有性能或中低风险问题时
    用 APPROVED_WITH_CHANGES；几乎无问题时 APPROVED。
    """

    def __init__(
        self,
        sql_tuner: Optional[SQLTuner] = None,
        privacy_auditor: Optional[PrivacyAuditor] = None,
        tuning_harness: Optional[SQLTuningHarness] = None,
        llm_client: Optional[LLMClient] = None,
    ):
        self.llm_client = llm_client or LLMClient()
        self.sql_tuner = sql_tuner or SQLTuner(llm_client=self.llm_client)
        self.privacy_auditor = privacy_auditor or PrivacyAuditor(llm_client=self.llm_client)
        self.tuning_harness = tuning_harness  # built lazily; needs DB client
        logger.debug("SQL Governance Board (multi-agent) initialized")

    # ----- Specialist agents -------------------------------------------------
    def _performance_agent(self, sql: str, explain_plan: str, db_type: str) -> SpecialistVerdict:
        try:
            rec = self.sql_tuner.optimize_query(sql, explain_plan, db_type=db_type)
            findings = [rec.bottleneck_analysis]
            if rec.suggested_indexes:
                findings.append("建议索引：" + "; ".join(rec.suggested_indexes))
            return SpecialistVerdict(
                agent="performance",
                role="性能调优专家",
                status="ok",
                headline=f"预计{rec.estimated_speedup}；{rec.optimization_strategy[:40]}",
                risk_contribution=0,  # performance does not add compliance risk
                findings=findings,
                payload=rec.model_dump(),
            )
        except Exception as e:
            logger.error(f"PerformanceAgent failed: {e}")
            return SpecialistVerdict(agent="performance", role="性能调优专家", status="error",
                                     headline=f"性能分析失败：{e}", findings=[])

    def _security_agent(self, sql: str) -> SpecialistVerdict:
        try:
            report = self.privacy_auditor.audit_query(sql)
            findings = list(report.compliance_issues)
            if report.PII_columns_exposed:
                findings.append("暴露 PII 列：" + ", ".join(report.PII_columns_exposed))
            return SpecialistVerdict(
                agent="security",
                role="数据安全与合规专家",
                status="ok",
                headline=("未发现重大泄露风险" if report.is_safe
                          else f"存在合规风险，风险分 {report.risk_score}/100"),
                risk_contribution=int(report.risk_score),
                findings=findings or ["未发现明显合规问题。"],
                payload=report.model_dump(),
            )
        except Exception as e:
            logger.error(f"SecurityAgent failed: {e}")
            return SpecialistVerdict(agent="security", role="数据安全与合规专家", status="error",
                                     headline=f"安全审计失败：{e}", findings=[])

    def _anti_pattern_agent(self, sql: str) -> SpecialistVerdict:
        static_issues = _static_anti_patterns(sql)
        risk = min(100, sum(_SEVERITY_WEIGHT.get(i["severity"], 5) for i in static_issues))
        findings = [f"[{i['severity']}] {i['rule']}：{i['description']}" for i in static_issues]
        return SpecialistVerdict(
            agent="anti_pattern",
            role="SQL 反模式审查专家",
            status="ok",
            headline=(f"命中 {len(static_issues)} 个反模式" if static_issues else "未命中已知反模式"),
            risk_contribution=risk,
            findings=findings or ["未命中已知静态反模式。"],
            payload={"static_issues": static_issues},
        )

    def _sandbox_agent(self, original_sql: str, optimized_sql: str, indexes: List[str]) -> SpecialistVerdict:
        try:
            if self.tuning_harness is None:
                self.tuning_harness = SQLTuningHarness()
            report = self.tuning_harness.evaluate_tuning(original_sql, optimized_sql, indexes)
            return SpecialistVerdict(
                agent="sandbox",
                role="沙盒实测专家",
                status="ok",
                headline=report.performance_verdict,
                risk_contribution=0,
                findings=[
                    f"原始耗时 {report.original_latency_ms:.2f}ms → 优化后 {report.optimized_latency_ms:.2f}ms",
                    f"延迟降低 {report.latency_reduction_pct:.1f}%；语义一致性："
                    + ("通过" if report.semantic_equivalence_verified else "未通过"),
                ],
                payload=report.model_dump(),
            )
        except Exception as e:
            logger.error(f"SandboxAgent failed: {e}")
            return SpecialistVerdict(agent="sandbox", role="沙盒实测专家", status="error",
                                     headline=f"沙盒实测失败：{e}", findings=[])

    # ----- Supervisor --------------------------------------------------------
    def review(
        self,
        sql: str,
        explain_plan: str = "",
        db_type: str = "PostgreSQL",
        run_sandbox: bool = False,
    ) -> GovernanceReport:
        """Run the full multi-agent board review for a single SQL statement."""
        sql = sql.strip()
        logger.info(f"Governance Board review starting (sandbox={run_sandbox})")

        verdicts: List[SpecialistVerdict] = []
        # Run the three independent specialists concurrently to cut latency.
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {
                pool.submit(self._performance_agent, sql, explain_plan, db_type): "performance",
                pool.submit(self._security_agent, sql): "security",
                pool.submit(self._anti_pattern_agent, sql): "anti_pattern",
            }
            for fut in as_completed(futures):
                verdicts.append(fut.result())

        # Stable ordering: performance, security, anti_pattern.
        order = {"performance": 0, "security": 1, "anti_pattern": 2}
        verdicts.sort(key=lambda v: order.get(v.agent, 9))

        perf = next((v for v in verdicts if v.agent == "performance"), None)
        recommended_sql = sql
        if perf and perf.status == "ok":
            recommended_sql = perf.payload.get("optimized_sql", sql) or sql

        # Optional sandbox verification of the proposed rewrite.
        if run_sandbox and perf and perf.status == "ok":
            indexes = perf.payload.get("suggested_indexes", []) or []
            verdicts.append(self._sandbox_agent(sql, recommended_sql, indexes))

        # Deterministic, explainable overall risk: security dominates, anti-pattern adds.
        sec_risk = next((v.risk_contribution for v in verdicts if v.agent == "security"), 0)
        ap_risk = next((v.risk_contribution for v in verdicts if v.agent == "anti_pattern"), 0)
        overall_risk = min(100, int(0.7 * sec_risk + 0.5 * ap_risk))

        consensus, verdict, actions = self._supervise(verdicts, overall_risk)

        return GovernanceReport(
            overall_verdict=verdict,
            overall_risk_score=overall_risk,
            consensus_summary=consensus,
            recommended_sql=recommended_sql,
            action_items=actions,
            specialist_verdicts=verdicts,
        )

    def _supervise(self, verdicts: List[SpecialistVerdict], overall_risk: int):
        """Aggregate specialist verdicts into a final decision via the LLM supervisor."""
        # Deterministic fallback verdict (used if the LLM call fails).
        has_high = any(
            "HIGH" in f for v in verdicts if v.agent == "anti_pattern" for f in v.findings
        )
        if overall_risk >= 60 or (has_high and overall_risk >= 40):
            fallback_verdict = "BLOCKED"
        elif overall_risk >= 20 or has_high:
            fallback_verdict = "APPROVED_WITH_CHANGES"
        else:
            fallback_verdict = "APPROVED"

        digest = "\n".join(
            f"- 【{v.role}】({v.status}) {v.headline}"
            + ("".join(f"\n    · {fnd}" for fnd in v.findings) if v.findings else "")
            for v in verdicts
        )
        user_prompt = (
            f"以下是各专家智能体的评审意见（系统已计算综合风险分 = {overall_risk}/100）：\n"
            f"{digest}\n\n请按要求输出最终裁决 JSON。"
        )
        try:
            raw = self.llm_client.generate_completion(
                system_prompt=self.SUPERVISOR_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
            )
            cleaned = raw.strip()
            if "</think>" in cleaned:
                cleaned = cleaned.split("</think>")[-1].strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[-1].split("```")[0].strip()
            elif cleaned.startswith("```"):
                cleaned = cleaned.strip("`").strip()
            data = json.loads(cleaned)
            verdict = data.get("overall_verdict", fallback_verdict)
            if verdict not in ("APPROVED", "APPROVED_WITH_CHANGES", "BLOCKED"):
                verdict = fallback_verdict
            consensus = data.get("consensus_summary", "委员会已完成评审。")
            actions = data.get("action_items", []) or []
            return consensus, verdict, actions
        except Exception as e:
            logger.warning(f"Supervisor LLM aggregation failed, using deterministic fallback: {e}")
            actions = [f for v in verdicts for f in v.findings if v.agent in ("security", "anti_pattern")]
            return (
                f"（自动汇总）综合风险分 {overall_risk}/100。委员会基于各专家意见给出裁决：{fallback_verdict}。",
                fallback_verdict,
                actions[:6],
            )
