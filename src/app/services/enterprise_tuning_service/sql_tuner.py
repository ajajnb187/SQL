"""AI SQL Tuner analyzing execution plans and suggesting optimizations."""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

from src.utils.logging import get_logger
from ..text2sql_lg_service.llm_client import LLMClient
from ..text2sql_lg_service.exceptions import LLMClientException

logger = get_logger(__name__)


class TuningRecommendation(BaseModel):
    """Data model representing the output of an AI tuning operation."""
    
    original_sql: str
    optimized_sql: str
    suggested_indexes: List[str] = Field(default_factory=list, description="SQL DDL statements to create helpful indexes")
    bottleneck_analysis: str = Field(..., description="Explanation of performance bottlenecks identified in EXPLAIN plan")
    optimization_strategy: str = Field(..., description="Explanation of query rewriting or structural optimization applied")
    estimated_speedup: str = Field(..., description="e.g., '10x speedup', '50% cost reduction'")


class SQLTuner:
    """Enterprise SQL Query Optimizer powered by LLM Reasoning & Explain Plans."""

    SYSTEM_PROMPT = """
    You are a Principal Database Administrator (DBA) and PostgreSQL/MySQL Performance Tuning Expert.
    Your task is to analyze a slow or inefficient SQL statement—including SELECT, INSERT, UPDATE, DELETE, and DDL operations—as well as its execution plan, identify core architectural bottlenecks, and provide an optimized rewritten query, index adjustments, or configuration strategies.

    CRITICAL: All explanations, bottleneck analyses, and optimization strategies MUST be written entirely in Chinese (中文).

    Performance & Architectural Bottlenecks to look for:
    1. READ QUERY BOTTLENECK (SELECT):
       - Seq Scan (Sequential Scans) on high-cardinality tables.
       - Hash Joins or Nested Loops with high cost/rows.
       - Large Sort operations spilling to disk.
       - Subqueries that can be converted to CTEs (WITH clause) or JOINs.
       - Missing indexes on JOIN keys, WHERE filters, or GROUP BY fields.

    2. WRITE QUERY BOTTLENECK (INSERT, UPDATE, DELETE):
       - Lock Contention: Row-level lock escalation, deadlock risks, or blocking due to long-running transactions.
       - Excessive / Redundant Indexes: Too many indexes slow down INSERT/UPDATE/DELETE. Recommend dropping redundant indexes if write overhead is high.
       - Missing Foreign Key Indexes: Ensure child tables have indexes on foreign keys to prevent table locks during cascades.
       - Row-by-Row Operations: Identify single-row inserts/updates inside loops and recommend bulk inserting, bulk updates (e.g. using temp tables), or PostgreSQL COPY.
       - MVCC & Vacuum/Bloat (PostgreSQL): High UPDATE/DELETE rates leading to table bloat. Recommend auto-vacuum tuning, CTE modifications, or FILLFACTOR adjustments.

    3. TRANSACTION & SCHEMA BOTTLENECK (DDL):
       - Missing partitions on huge historical/timeseries tables.
       - Suboptimal column data types (e.g. using TEXT instead of VARCHAR, UUID indexing overhead vs BIGINT auto-increment).
       - Inefficient triggers or redundant constraints.

    You must respond with a clean, structured JSON object containing the exact fields requested, with no markdown code blocks outside the JSON itself.
    """

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm_client = llm_client or LLMClient()
        logger.debug("AI SQL Tuner initialized")

    def optimize_query(
        self,
        original_sql: str,
        explain_plan: str,
        db_type: str = "PostgreSQL",
    ) -> TuningRecommendation:
        """
        Analyzes a query plan and generates a complete tuning recommendation.
        
        Args:
            original_sql: The query needing optimization
            explain_plan: Output of EXPLAIN (or EXPLAIN ANALYZE) run on the database
            db_type: Database engine type (PostgreSQL, MySQL, SQLite)
        """
        user_prompt = f"""
        Database Engine: {db_type}
        
        Original SQL Query:
        ```sql
        {original_sql}
        ```
        
        Execution Plan (EXPLAIN output):
        ```text
        {explain_plan}
        ```
        
        Provide your expert tuning recommendations as a raw JSON matching this structure (Remember: you MUST write all explanations, analyses, and strategies in Chinese):
        {{
            "original_sql": "{original_sql.replace('"', '\\"')}",
            "optimized_sql": "[The fully rewritten, optimized SQL query]",
            "suggested_indexes": [
                "CREATE INDEX idx_your_table_column ON schema.table(column);"
            ],
            "bottleneck_analysis": "[用中文详细解释为什么原始 SQL 查询执行慢，具体指明是哪些执行计划节点或字段索引问题导致的瓶颈]",
            "optimization_strategy": "[用中文详细说明您应用了哪些 SQL 重构技巧、CTE 改写或索引调整策略来实现极致提速]",
            "estimated_speedup": "[中文估算性能提升，例如：'提速 5 倍' 或 '耗时大幅降低 80%']"
        }}
        
        Ensure your response is ONLY the raw JSON object, valid and parsable. Do not wrap it in ```json blocks or add conversational text.
        """
        
        logger.info(f"Initiating AI SQL Tuning analysis for query of length {len(original_sql)}")
        
        try:
            # We use the free DeepSeek-R1-8B model which has fantastic DBA knowledge because of its reasoning capability
            response_text = self.llm_client.generate_completion(
                system_prompt=self.SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.1,  # Ultra-deterministic for structural SQL generation
            )
            
            # Clean possible reasoning thinking process and markdown wrap from the LLM output
            cleaned_text = response_text.strip()
            if "</think>" in cleaned_text:
                cleaned_text = cleaned_text.split("</think>")[-1].strip()
            
            if "```json" in cleaned_text:
                cleaned_text = cleaned_text.split("```json")[-1].split("```")[0].strip()
            elif "```" in cleaned_text:
                cleaned_text = cleaned_text.split("```")[-1].split("```")[0].strip()
            
            cleaned_text = cleaned_text.strip()
            
            import json
            data = json.loads(cleaned_text)
            
            rec = TuningRecommendation(
                original_sql=original_sql,
                optimized_sql=data.get("optimized_sql", original_sql),
                suggested_indexes=data.get("suggested_indexes", []),
                bottleneck_analysis=data.get("bottleneck_analysis", "No bottleneck analyzed."),
                optimization_strategy=data.get("optimization_strategy", "No strategy provided."),
                estimated_speedup=data.get("estimated_speedup", "1x"),
            )
            
            logger.info("AI tuning recommendation generated successfully")
            return rec
            
        except Exception as e:
            logger.error(f"Failed to generate SQL tuning recommendation: {e}")
            # Safe fallback if JSON parsing or completion fails
            return TuningRecommendation(
                original_sql=original_sql,
                optimized_sql=original_sql,
                suggested_indexes=[],
                bottleneck_analysis=f"Tuning failed to compile: {str(e)}",
                optimization_strategy="N/A",
                estimated_speedup="1x",
            )
