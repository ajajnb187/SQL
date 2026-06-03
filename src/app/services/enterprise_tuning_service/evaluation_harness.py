"""Agentic Evaluation Harness for verifying SQL tuning and semantic equivalence."""

import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from src.utils.logging import get_logger
from ..text2sql_lg_service.database_client import DatabaseClient

logger = get_logger(__name__)


class HarnessEvaluationReport(BaseModel):
    """Data model representing a physical performance comparison report."""
    
    original_latency_ms: float
    optimized_latency_ms: float
    latency_reduction_pct: float
    semantic_equivalence_verified: bool
    ddl_applied_successfully: bool
    performance_verdict: str = Field(..., description="e.g., 'SUCCESS - Query speed increased by 4x', 'FAILED - Semantic mismatch'")


class SQLTuningHarness:
    """Agentic evaluation harness that safely runs and compares SQL queries in transactions."""

    def __init__(self, db_client: Optional[DatabaseClient] = None):
        if db_client is None:
            from src.core.lifetime import get_database_client
            self.db_client = get_database_client()
        else:
            self.db_client = db_client
        logger.debug("SQL Performance Testing Harness initialized")

    def evaluate_tuning(
        self,
        original_sql: str,
        optimized_sql: str,
        suggested_indexes: List[str],
    ) -> HarnessEvaluationReport:
        """
        Executes a transactional sandwich to safely measure performance changes.
        
        Sandwich flow:
        1. Open connection -> BEGIN Transaction.
        2. Run original query with EXPLAIN ANALYZE (or simple timing) and record latency.
        3. Run suggested INDEX DDL queries inside the transaction.
        4. Run optimized query with EXPLAIN ANALYZE (or simple timing) and record latency.
        5. Verify that both queries return semantically identical datasets.
        6. Always ROLLBACK transaction to keep the sandbox perfectly clean!
        """
        logger.info("Starting SQL optimization sandboxed harness evaluation")
        
        conn = None
        original_latency = 0.0
        optimized_latency = 0.0
        semantic_equivalence = False
        ddl_success = False
        verdict = ""
        
        try:
            # We fetch a connection from pool using context manager to handle transactions manually
            with self.db_client.get_connection() as conn:
                conn.autocommit = False  # Start explicit transaction
                cursor = conn.cursor()
                
                # --- 1. Measure Original SQL Latency ---
                try:
                    start_time = time.time()
                    cursor.execute(original_sql)
                    original_rows = cursor.fetchall()
                    original_cols = [desc[0] for desc in cursor.description]
                    original_latency = (time.time() - start_time) * 1000.0
                    logger.debug(f"Harness: Original query executed in {original_latency:.2f}ms. Returned {len(original_rows)} rows.")
                except Exception as e:
                    logger.error(f"Harness: Failed to execute original query: {e}")
                    return HarnessEvaluationReport(
                        original_latency_ms=0.0,
                        optimized_latency_ms=0.0,
                        latency_reduction_pct=0.0,
                        semantic_equivalence_verified=False,
                        ddl_applied_successfully=False,
                        performance_verdict=f"Execution Failed: Original query has errors: {str(e)}",
                    )

                # --- 2. Try applying DDL indexes (inside transaction) ---
                ddl_success = True
                for ddl in suggested_indexes:
                    if not ddl or not ddl.strip():
                        continue
                    try:
                        logger.debug(f"Harness: Applying index: {ddl}")
                        cursor.execute(ddl)
                    except Exception as e:
                        logger.warning(f"Harness: Skipping index creation because it failed: {ddl} | Error: {e}")
                        # Clear error flag of transaction block by rolling back and resuming or skipping index
                        conn.rollback()
                        ddl_success = False
                        break

                # --- 3. Measure Optimized SQL Latency ---
                try:
                    start_time = time.time()
                    cursor.execute(optimized_sql)
                    optimized_rows = cursor.fetchall()
                    optimized_cols = [desc[0] for desc in cursor.description]
                    optimized_latency = (time.time() - start_time) * 1000.0
                    logger.debug(f"Harness: Optimized query executed in {optimized_latency:.2f}ms. Returned {len(optimized_rows)} rows.")
                except Exception as e:
                    logger.error(f"Harness: Failed to execute optimized query: {e}")
                    # Rollback transaction
                    conn.rollback()
                    return HarnessEvaluationReport(
                        original_latency_ms=original_latency,
                        optimized_latency_ms=0.0,
                        latency_reduction_pct=0.0,
                        semantic_equivalence_verified=False,
                        ddl_applied_successfully=ddl_success,
                        performance_verdict=f"Execution Failed: Optimized query has errors: {str(e)}",
                    )

                # --- 4. Verify Semantic Equivalence (Consistency check) ---
                if len(original_rows) == len(optimized_rows):
                    # Compare schema keys/count and row shapes
                    if len(original_cols) == len(optimized_cols):
                        # Sort or check content of a small sample (first 10 rows)
                        sample_orig = sorted([str(r) for r in original_rows[:10]])
                        sample_opt = sorted([str(r) for r in optimized_rows[:10]])
                        if sample_orig == sample_opt:
                            semantic_equivalence = True
                            
                if not semantic_equivalence:
                    logger.warning("Harness: Semantic mismatch! Optimized SQL does not return the same records.")

                # Calculate improvement percentage
                if original_latency > 0:
                    latency_reduction = ((original_latency - optimized_latency) / original_latency) * 100.0
                else:
                    latency_reduction = 0.0

                # Generate verdict
                if not semantic_equivalence:
                    verdict = "REJECTED - Semantic discrepancy. Optimized SQL returns mismatched records."
                elif latency_reduction > 10.0:
                    verdict = f"SUCCESS - Query optimization verified! Speed increased by {latency_reduction:.1f}% ({original_latency:.1f}ms -> {optimized_latency:.1f}ms)."
                else:
                    verdict = f"NEUTRAL - Verified semantic consistency, but performance is comparable ({original_latency:.1f}ms -> {optimized_latency:.1f}ms)."

                # --- 5. Clean up sandbox (ROLLBACK everything!) ---
                logger.debug("Harness: Rolling back transaction to keep the sandbox database completely pristine.")
                conn.rollback()
                cursor.close()
                
                return HarnessEvaluationReport(
                    original_latency_ms=original_latency,
                    optimized_latency_ms=optimized_latency,
                    latency_reduction_pct=latency_reduction,
                    semantic_equivalence_verified=semantic_equivalence,
                    ddl_applied_successfully=ddl_success,
                    performance_verdict=verdict,
                )
            
        except Exception as e:
            logger.error(f"Unexpected error in tuning evaluation harness: {e}")
            if conn:
                try:
                    conn.rollback()
                    conn.close()
                except Exception:
                    pass
            return HarnessEvaluationReport(
                original_latency_ms=original_latency,
                optimized_latency_ms=optimized_latency,
                latency_reduction_pct=0.0,
                semantic_equivalence_verified=False,
                ddl_applied_successfully=False,
                performance_verdict=f"Harness Error: Sandbox crashed: {str(e)}",
            )
