import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Users,
  Gauge,
  ShieldAlert,
  ScrollText,
  FlaskConical,
  Sparkles,
  ShieldCheck,
  Ban,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface SpecialistVerdict {
  agent: string;
  role: string;
  status: string;
  headline: string;
  risk_contribution: number;
  findings: string[];
  payload: Record<string, unknown>;
}

interface GovernanceReport {
  overall_verdict: "APPROVED" | "APPROVED_WITH_CHANGES" | "BLOCKED";
  overall_risk_score: number;
  consensus_summary: string;
  recommended_sql: string;
  action_items: string[];
  specialist_verdicts: SpecialistVerdict[];
}

const AGENT_ICON: Record<string, typeof Gauge> = {
  performance: Gauge,
  security: ShieldAlert,
  anti_pattern: ScrollText,
  sandbox: FlaskConical,
};

const VERDICT_META: Record<string, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  APPROVED: { label: "通过 (APPROVED)", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: ShieldCheck },
  APPROVED_WITH_CHANGES: { label: "整改后通过 (APPROVED_WITH_CHANGES)", cls: "bg-amber-100 text-amber-700 border-amber-200", Icon: AlertTriangle },
  BLOCKED: { label: "阻断 (BLOCKED)", cls: "bg-red-100 text-red-700 border-red-200", Icon: Ban },
};

function riskColor(score: number): string {
  if (score >= 60) return "text-red-600";
  if (score >= 20) return "text-amber-600";
  return "text-emerald-600";
}

const GovernanceBoardView = () => {
  const [sql, setSql] = useState(
    "SELECT * FROM causal_inference.sales WHERE customer_email LIKE '%@gmail.com'"
  );
  const [runSandbox, setRunSandbox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GovernanceReport | null>(null);

  const runReview = async () => {
    if (!sql.trim()) {
      toast.error("请输入需要会审的 SQL 语句");
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch("/api/text2sql_lg_code/enterprise/agents/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql_query: sql, run_sandbox: runSandbox }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.error || `请求失败 (${res.status})`);
      }
      const data = await res.json();
      setReport(data.report as GovernanceReport);
      toast.success("多智能体会审完成");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "会审失败");
    } finally {
      setLoading(false);
    }
  };

  const verdictMeta = report ? VERDICT_META[report.overall_verdict] ?? VERDICT_META.APPROVED_WITH_CHANGES : null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-2.5">
          <Users className="w-7 h-7 text-indigo-500" />
          AI 多智能体 SQL 治理委员会
        </h1>
        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
          由「主审官 Supervisor」统一调度 [性能调优] · [数据安全合规] · [反模式审查] · [沙盒实测] 四个专家智能体，
          对一条 SQL 进行并行多维评审，输出统一裁决、综合风险分与按优先级排序的整改清单。
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* 输入区 */}
        <div className="xl:col-span-5 space-y-5">
          <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-extrabold text-indigo-600 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                提交 SQL 会审
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                输入要评审的 SQL，委员会将从性能、安全、规范多角度并行分析。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                rows={6}
                className="font-mono text-xs bg-slate-50 border-slate-200 text-slate-800"
                placeholder="在此粘贴需要会审的 SQL 语句..."
              />
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={runSandbox}
                  onChange={(e) => setRunSandbox(e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-600"
                />
                启用沙盒实测专家（在回滚事务中实测优化前后性能，较慢）
              </label>
              <Button
                onClick={runReview}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> 多智能体会审进行中...
                  </span>
                ) : (
                  "启动多智能体会审"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 综合裁决卡片 */}
          {report && verdictMeta && (
            <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${verdictMeta.cls}`}>
                    <verdictMeta.Icon className="w-4 h-4" />
                    {verdictMeta.label}
                  </span>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">综合风险分</p>
                    <p className={`text-2xl font-black ${riskColor(report.overall_risk_score)}`}>
                      {report.overall_risk_score}
                      <span className="text-sm text-slate-400">/100</span>
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">主审官综合裁决</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{report.consensus_summary}</p>
                </div>
                {report.action_items?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1.5">整改清单（按优先级）</p>
                    <ol className="space-y-1.5">
                      {report.action_items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-600">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-black flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 专家意见区 */}
        <div className="xl:col-span-7 space-y-4">
          {!report && !loading && (
            <div className="h-80 rounded-2xl bg-slate-50/60 border border-slate-200 border-dashed flex items-center justify-center">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                <p className="text-slate-600 font-bold text-sm">等待提交 SQL 会审</p>
                <p className="text-[11px] text-slate-400 mt-1">各专家智能体的独立评审意见将在此呈现。</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="h-80 rounded-2xl bg-slate-50/60 border border-slate-200 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-10 h-10 mx-auto mb-3 text-indigo-500 animate-spin" />
                <p className="text-slate-700 font-bold text-sm">四位专家智能体正在并行评审...</p>
              </div>
            </div>
          )}

          {report?.specialist_verdicts?.map((v) => {
            const Icon = AGENT_ICON[v.agent] ?? Sparkles;
            return (
              <Card key={v.agent} className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-slate-800">{v.role}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{v.agent}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {v.risk_contribution > 0 && (
                        <span className={`text-[10px] font-black ${riskColor(v.risk_contribution)}`}>
                          风险 {v.risk_contribution}
                        </span>
                      )}
                      <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase ${
                        v.status === "ok" ? "bg-emerald-100 text-emerald-700"
                          : v.status === "error" ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {v.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-semibold mt-3 leading-relaxed">{v.headline}</p>
                  {v.findings?.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5">
                      {v.findings.map((f, i) => (
                        <li key={i} className="text-[11px] text-slate-500 leading-relaxed flex gap-1.5">
                          <span className="text-indigo-400 shrink-0">·</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {report && (
            <Card className="bg-slate-900 border-slate-800 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <p className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-wider mb-2">委员会推荐采用的优化 SQL</p>
                <pre className="text-[11px] text-emerald-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {report.recommended_sql}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default GovernanceBoardView;
