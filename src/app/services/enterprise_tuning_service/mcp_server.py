"""MCP Server for Model Context Protocol integration in Enterprise Database APM and Tuning."""

import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from src.utils.logging import get_logger
from .apm_tracer import APMTracer
from .sql_tuner import SQLTuner
from .privacy_auditor import PrivacyAuditor
from .evaluation_harness import SQLTuningHarness

logger = get_logger(__name__)


class MCPToolDefinition(BaseModel):
    """Represents an MCP-compliant Tool schema for LLMs."""
    
    name: str
    description: str
    input_schema: Dict[str, Any]


class ModelContextProtocolServer:
    """
    Model Context Protocol (MCP) server for Database APM, Tuning, and Security.
    
    Exposes standard MCP Tools allowing AI agents to seamlessly inspect database traces,
    parse explain plans, rewrite queries, audit PII risks, and test performance in sandboxes.
    """

    def __init__(
        self,
        apm_tracer: Optional[APMTracer] = None,
        sql_tuner: Optional[SQLTuner] = None,
        privacy_auditor: Optional[PrivacyAuditor] = None,
        tuning_harness: Optional[SQLTuningHarness] = None,
    ):
        self.apm_tracer = apm_tracer or APMTracer()
        self.sql_tuner = sql_tuner or SQLTuner()
        self.privacy_auditor = privacy_auditor or PrivacyAuditor()
        self.tuning_harness = tuning_harness or SQLTuningHarness()
        logger.debug("Model Context Protocol (MCP) Server initialized")

    def list_tools(self) -> List[MCPToolDefinition]:
        """Exposes standard MCP tool declarations for LLM tool binding."""
        return [
            MCPToolDefinition(
                name="list_apm_traces",
                description="List intercepted SQL queries triggered by application API endpoints, with execution times and code callstacks.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "api_endpoint": {"type": "string", "description": "Filter by specific REST api path"},
                        "slow_only_ms": {"type": "number", "description": "Filter queries taking more than this threshold"},
                        "limit": {"type": "integer", "default": 10}
                    }
                }
            ),
            MCPToolDefinition(
                name="optimize_sql_query",
                description="DBA SQL optimization tool. Takes a SQL query and its EXPLAIN execution plan, and outputs a highly optimized rewritten query with DDL indexes.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "original_sql": {"type": "string", "description": "The slow SQL statement"},
                        "explain_plan": {"type": "string", "description": "The EXPLAIN (or EXPLAIN ANALYZE) text output from the database"}
                    },
                    "required": ["original_sql", "explain_plan"]
                }
            ),
            MCPToolDefinition(
                name="audit_sql_privacy",
                description="Data security audit tool. Analyzes a SQL query for PII leakage, unbounded full-table scans, or privacy compliance (GDPR/PIPEDA) issues.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "sql_query": {"type": "string", "description": "SQL statement to audit for sensitive fields and leakage risks"}
                    },
                    "required": ["sql_query"]
                }
            ),
            MCPToolDefinition(
                name="verify_optimization_harness",
                description="Performance Verification Harness. Safely runs original vs optimized SQL + proposed indexes in a sandboxed TRANSACTION, measuring performance, and then ROLLS BACK to prevent schema pollution.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "original_sql": {"type": "string", "description": "The original slow query"},
                        "optimized_sql": {"type": "string", "description": "The rewritten optimized query"},
                        "suggested_indexes": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Index DDL queries (e.g., 'CREATE INDEX ...') to temporarily apply in transaction"
                        }
                    },
                    "required": ["original_sql", "optimized_sql", "suggested_indexes"]
                }
            )
        ]

    def handle_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """
        Processes standard JSON-RPC tool invocations from an MCP-compliant AI Client.
        
        Returns:
            JSON-formatted string containing tool response payload
        """
        logger.info(f"MCP Server: Received tool call invocation for '{tool_name}'")
        
        try:
            if tool_name == "list_apm_traces":
                api_endpoint = arguments.get("api_endpoint")
                slow_only_ms = arguments.get("slow_only_ms")
                limit = arguments.get("limit", 10)
                traces = self.apm_tracer.get_traces(api_endpoint=api_endpoint, slow_only_ms=slow_only_ms, limit=limit)
                return json.dumps([t.model_dump() for t in traces], default=str)
                
            elif tool_name == "optimize_sql_query":
                original_sql = arguments["original_sql"]
                explain_plan = arguments["explain_plan"]
                rec = self.sql_tuner.optimize_query(original_sql, explain_plan)
                return json.dumps(rec.model_dump())
                
            elif tool_name == "audit_sql_privacy":
                sql_query = arguments["sql_query"]
                report = self.privacy_auditor.audit_query(sql_query)
                return json.dumps(report.model_dump())
                
            elif tool_name == "verify_optimization_harness":
                orig = arguments["original_sql"]
                opt = arguments["optimized_sql"]
                idx = arguments["suggested_indexes"]
                report = self.tuning_harness.evaluate_tuning(orig, opt, idx)
                return json.dumps(report.model_dump())
                
            else:
                logger.error(f"MCP Server: Requested tool '{tool_name}' is not registered on this server.")
                return json.dumps({"error": f"Tool '{tool_name}' not found"})
                
        except Exception as e:
            logger.error(f"MCP Server tool execution failed: {e}")
            return json.dumps({"error": f"Internal MCP server error: {str(e)}"})
