"""Real MCP (Model Context Protocol) server for the enterprise SQL platform.

Built on `fastmcp` (the de-facto standard MCP framework) — this exposes the
project's OWN domain capabilities (APM tracing, AI tuning, privacy auditing,
sandbox benchmarking, anti-pattern review, and the multi-agent governance board)
as standard MCP tools. Any MCP client (Claude Desktop, Cursor, Cline, etc.) can
connect and drive these tools directly.

This complements `mcp_server.py` (an in-process tool registry used by the web
API). `mcp_app.py` is a *transport-level* MCP server with stdio/HTTP support.

Run it:
    # stdio (for Claude Desktop / Cursor)
    python -m src.app.services.enterprise_tuning_service.mcp_app
    # or streamable HTTP
    python -m src.app.services.enterprise_tuning_service.mcp_app --http --port 9000

Register in an MCP client config, e.g. Claude Desktop:
    {
      "mcpServers": {
        "sql-governance": {
          "command": "python",
          "args": ["-m", "src.app.services.enterprise_tuning_service.mcp_app"],
          "cwd": "/path/to/SQL"
        }
      }
    }
"""

from __future__ import annotations

import argparse
from typing import Any, Dict, List

from fastmcp import FastMCP

from src.utils.logging import get_logger
from .apm_tracer import apm_tracer
from .sql_tuner import SQLTuner
from .privacy_auditor import PrivacyAuditor
from .evaluation_harness import SQLTuningHarness
from .governance_board import SQLGovernanceBoard, _static_anti_patterns

logger = get_logger(__name__)

mcp = FastMCP(
    name="sql-governance",
    instructions=(
        "Enterprise SQL APM, tuning, privacy auditing, and multi-agent governance "
        "tools for PostgreSQL/MySQL. Use `optimize_sql` for rewrite + index advice, "
        "`audit_sql_privacy` for PII/compliance checks, `audit_anti_patterns` for "
        "static+AI anti-pattern review, `benchmark_sql` to measure speedup in a "
        "rolled-back sandbox transaction, `list_apm_traces` to inspect intercepted "
        "queries, and `governance_review` to run the full multi-agent board."
    ),
)

# Lazily-built singletons (avoid constructing LLM clients at import time).
_tuner: SQLTuner | None = None
_auditor: PrivacyAuditor | None = None
_harness: SQLTuningHarness | None = None
_board: SQLGovernanceBoard | None = None


def _get_tuner() -> SQLTuner:
    global _tuner
    if _tuner is None:
        _tuner = SQLTuner()
    return _tuner


def _get_auditor() -> PrivacyAuditor:
    global _auditor
    if _auditor is None:
        _auditor = PrivacyAuditor()
    return _auditor


def _get_harness() -> SQLTuningHarness:
    global _harness
    if _harness is None:
        # Sandbox benchmarking needs a live DB client. Outside the FastAPI
        # lifespan (standalone MCP server) we must initialize it ourselves.
        from src.core.lifetime import ensure_database_client
        ensure_database_client()
        _harness = SQLTuningHarness()
    return _harness


def _get_board() -> SQLGovernanceBoard:
    global _board
    if _board is None:
        _board = SQLGovernanceBoard(
            sql_tuner=_get_tuner(),
            privacy_auditor=_get_auditor(),
            tuning_harness=_get_harness(),
        )
    return _board


@mcp.tool
def list_apm_traces(limit: int = 10, slow_only_ms: float | None = None) -> List[Dict[str, Any]]:
    """List intercepted SQL queries (APM traces) with execution times and callstacks.

    Args:
        limit: Max number of traces to return.
        slow_only_ms: If set, only return traces slower than this threshold (ms).
    """
    traces = apm_tracer.get_traces(slow_only_ms=slow_only_ms, limit=limit)
    return [t.model_dump() for t in traces]


@mcp.tool
def optimize_sql(original_sql: str, explain_plan: str = "", db_type: str = "PostgreSQL") -> Dict[str, Any]:
    """Analyze a slow SQL query + its EXPLAIN plan and return an optimized rewrite.

    Returns the rewritten SQL, suggested index DDL, a Chinese bottleneck analysis,
    the optimization strategy, and an estimated speedup.
    """
    rec = _get_tuner().optimize_query(original_sql, explain_plan, db_type=db_type)
    return rec.model_dump()


@mcp.tool
def audit_sql_privacy(sql_query: str) -> Dict[str, Any]:
    """Audit a SQL query for PII leakage and GDPR/HIPAA/PIPEDA compliance risks.

    Returns is_safe, a 0-100 risk score, exposed PII columns, compliance issues,
    and recommended remediation.
    """
    report = _get_auditor().audit_query(sql_query)
    return report.model_dump()


@mcp.tool
def audit_anti_patterns(sql_query: str) -> Dict[str, Any]:
    """Run static anti-pattern rules (SELECT *, missing LIMIT, leading-wildcard LIKE,
    explicit locks, cartesian joins) against a SQL query.

    Returns the list of matched issues with severity and Chinese descriptions.
    """
    issues = _static_anti_patterns(sql_query.strip())
    return {"sql": sql_query, "issue_count": len(issues), "issues": issues}


@mcp.tool
def benchmark_sql(original_sql: str, optimized_sql: str, suggested_indexes: List[str]) -> Dict[str, Any]:
    """Run original vs optimized SQL (+ proposed indexes) in a rolled-back sandbox
    transaction and report measured latency reduction and semantic equivalence.
    """
    report = _get_harness().evaluate_tuning(original_sql, optimized_sql, suggested_indexes)
    return report.model_dump()


@mcp.tool
def governance_review(sql_query: str, explain_plan: str = "", db_type: str = "PostgreSQL",
                      run_sandbox: bool = False) -> Dict[str, Any]:
    """Run the full multi-agent SQL Governance Board (Performance + Security +
    Anti-Pattern + optional Sandbox under a Supervisor) and return a single
    consolidated verdict, risk score, recommended SQL, and action items.
    """
    report = _get_board().review(
        sql_query, explain_plan=explain_plan, db_type=db_type, run_sandbox=run_sandbox
    )
    return report.model_dump()


def main() -> None:
    parser = argparse.ArgumentParser(description="SQL Governance MCP server")
    parser.add_argument("--http", action="store_true", help="Serve over streamable HTTP instead of stdio")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9000)
    args = parser.parse_args()

    # Initialize the DB client up front so DB-backed tools (governance_review,
    # benchmark_sql) work in this standalone process without the FastAPI lifespan.
    from src.core.lifetime import ensure_database_client
    ensure_database_client()

    if args.http:
        logger.info(f"Starting SQL Governance MCP server (HTTP) on {args.host}:{args.port}")
        mcp.run(transport="http", host=args.host, port=args.port)
    else:
        logger.info("Starting SQL Governance MCP server (stdio)")
        mcp.run()


if __name__ == "__main__":
    main()
