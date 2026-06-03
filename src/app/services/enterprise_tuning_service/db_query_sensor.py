"""
Enterprise Database Query Sensor Agent.
Polles PostgreSQL and MySQL in the background to capture executing queries from any application.
"""

import time
import threading
from typing import List, Dict, Any, Optional
from src.utils.logging import get_logger

logger = get_logger(__name__)


class DBQuerySensor:
    """Background agent that polls database-level logs/catalogs to intercept queries."""

    def __init__(self, poll_interval_seconds: float = 5.0):
        self.poll_interval = poll_interval_seconds
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._seen_queries = set()  # De-duplicate queries to avoid flooding the APM UI
        self.logs = []  # Log buffer for diagnostic inspection in frontend console
        self.log_event("Database Zero-Invasive Query Sensor initialized")

    def log_event(self, msg: str) -> None:
        """Helper to append a timestamped log to the in-memory log buffer."""
        import datetime
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_line = f"[{now}] {msg}"
        self.logs.append(log_line)
        if len(self.logs) > 100:
            self.logs.pop(0)
        logger.info(msg)

    def start(self) -> None:
        """Starts the background sensor thread."""
        if self._thread is not None and self._thread.is_alive():
            logger.warning("Query Sensor is already running.")
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, name="db-query-sensor", daemon=True)
        self._thread.start()
        logger.info("Database Query Sensor thread started successfully.")

    def stop(self) -> None:
        """Stops the background sensor thread."""
        if self._thread is None:
            return
        self._stop_event.set()
        self._thread.join(timeout=3.0)
        self._thread = None
        logger.info("Database Query Sensor thread stopped.")

    def _run_loop(self) -> None:
        """Main polling loop running in the background thread."""
        # Warm up sleep to let app startup completely
        time.sleep(3.0)
        
        while not self._stop_event.is_set():
            try:
                self._poll_database()
            except Exception as e:
                logger.error(f"Error in DBQuerySensor polling run: {e}")
            
            # Sleep with interruptible check
            self._stop_event.wait(self.poll_interval)

    def _poll_database(self) -> None:
        """Introspects PG / MySQL current activity and registers SQL queries in APMTracer."""
        from src.app.services.enterprise_tuning_service.multi_db_manager import db_manager
        
        client = db_manager.get_client()
        if client is None:
            self.log_event("Polling skipped: No active database client configured.")
            return

        dialect = getattr(client, "dialect", "postgresql")
        db_name = getattr(client, "dbname", "postgres")
        
        self.log_event(f"Polling database '{db_name}' ({dialect}) for queries...")
        queries_to_register = []

        if dialect == "postgresql":
            # Attempt 1: Fetch from pg_stat_statements (historical)
            try:
                sql = """
                    SELECT query, calls, total_exec_time as total_time_ms
                    FROM public.pg_stat_statements
                    WHERE query NOT LIKE '%pg_stat_statements%'
                      AND query NOT LIKE '%pg_stat_activity%'
                      AND query NOT LIKE '%enterprise/apm/collect%'
                      AND query NOT LIKE 'SELECT %'  -- Filter out simple telemetry select queries
                    ORDER BY total_exec_time DESC
                    LIMIT 15;
                """
                rows = client.execute_query(sql)
                self.log_event(f"pg_stat_statements query successful. Fetched {len(rows)} statements.")
                for r in rows:
                    queries_to_register.append({
                        "sql": r["query"],
                        "latency": float(r["total_time_ms"]) / max(1, int(r["calls"])),
                        "endpoint": f"PG (pg_stat_statements) x{r['calls']}"
                    })
            except Exception as e:
                self.log_event(f"pg_stat_statements failed: {e}. Falling back to active processes...")
                # Fallback: Query pg_stat_activity for real-time active queries
                try:
                    sql = """
                        SELECT query, EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as total_time_ms
                        FROM pg_catalog.pg_stat_activity
                        WHERE state = 'active'
                          AND query NOT LIKE '%pg_stat_activity%'
                          AND query NOT LIKE '%pg_stat_statements%'
                          AND query NOT LIKE '%enterprise/apm/collect%'
                          AND length(query) > 15
                        LIMIT 10;
                    """
                    rows = client.execute_query(sql)
                    self.log_event(f"pg_stat_activity query successful. Fetched {len(rows)} active processes.")
                    for r in rows:
                        queries_to_register.append({
                            "sql": r["query"],
                            "latency": float(r["total_time_ms"]),
                            "endpoint": "PG Realtime (pg_stat_activity)"
                        })
                except Exception as e2:
                    self.log_event(f"PostgreSQL PG query poll fallback failed: {e2}")

        elif dialect == "mysql":
            # Attempt 1: Fetch from general_log (which records 100% of all executed SQL statements)
            try:
                sql = """
                    SELECT argument as query, 0.1 as total_time_ms
                    FROM mysql.general_log
                    WHERE command_type = 'Query'
                      AND argument IS NOT NULL
                      AND argument NOT LIKE '%mysql.general_log%'
                      AND argument NOT LIKE '%enterprise/apm/collect%'
                      AND length(argument) > 15
                    ORDER BY event_time DESC
                    LIMIT 20;
                """
                rows = client.execute_query(sql)
                self.log_event(f"mysql.general_log query successful. Fetched {len(rows)} queries.")
                for r in rows:
                    sql_text = r["query"]
                    if isinstance(sql_text, bytes):
                        sql_text = sql_text.decode("utf-8", errors="ignore")
                    queries_to_register.append({
                        "sql": sql_text,
                        "latency": float(r["total_time_ms"]),
                        "endpoint": "MySQL (general_log)"
                    })
            except Exception as e:
                self.log_event(f"mysql.general_log query failed: {e}. Falling back to performance_schema...")
                # Fallback 1: Query performance_schema
                try:
                    sql = """
                        SELECT SQL_TEXT as query, TIMER_WAIT / 1000000000 as total_time_ms
                        FROM performance_schema.events_statements_history_long
                        WHERE SQL_TEXT IS NOT NULL
                          AND SQL_TEXT NOT LIKE '%performance_schema%'
                          AND SQL_TEXT NOT LIKE '%enterprise/apm/collect%'
                          AND length(SQL_TEXT) > 15
                        ORDER BY TIMER_START DESC
                        LIMIT 20;
                    """
                    rows = client.execute_query(sql)
                    self.log_event(f"events_statements_history_long query successful. Fetched {len(rows)} queries.")
                    for r in rows:
                        queries_to_register.append({
                            "sql": r["query"],
                            "latency": float(r["total_time_ms"]),
                            "endpoint": "MySQL (events_statements_history_long)"
                        })
                except Exception as e2:
                    self.log_event(f"events_statements_history_long fallback failed: {e2}. Falling back to processlist...")
                    # Fallback 2: Query processlist
                    try:
                        sql = """
                            SELECT INFO as query, TIME * 1000 as total_time_ms
                            FROM information_schema.processlist
                            WHERE COMMAND = 'Query'
                              AND INFO IS NOT NULL
                              AND INFO NOT LIKE '%processlist%'
                              AND INFO NOT LIKE '%enterprise/apm/collect%'
                            LIMIT 10;
                        """
                        rows = client.execute_query(sql)
                        self.log_event(f"processlist query successful. Fetched {len(rows)} queries.")
                        for r in rows:
                            queries_to_register.append({
                                "sql": r["query"],
                                "latency": float(r["total_time_ms"]),
                                "endpoint": "MySQL Realtime (processlist)"
                            })
                    except Exception as e3:
                        self.log_event(f"MySQL query poll fallback failed: {e3}")

        if not queries_to_register:
            self.log_event("Poll completed. No SQL queries detected on this run.")
            return

        from .apm_tracer import apm_tracer

        captured_count = 0
        for q in queries_to_register:
            sql_text = q["sql"].strip()
            # Basic validation and deduplication
            if not sql_text or len(sql_text) < 10:
                continue
                
            # Filter out connection setup/administrative metadata noise
            if sql_text.upper().startswith(("SET ", "SHOW ", "SELECT @@", "SELECT 1", "/*")):
                continue

            query_hash = (sql_text, q["endpoint"])
            if query_hash in self._seen_queries:
                continue
                
            self._seen_queries.add(query_hash)
            # Limit memory footprint
            if len(self._seen_queries) > 200:
                self._seen_queries.clear()

            # Record telemetry in APM tracer so it appears on the dashboard!
            try:
                apm_tracer.capture_sql_execution(
                    api_endpoint=q["endpoint"],
                    http_method="LISTEN",
                    sql_statement=sql_text,
                    execution_time_ms=q["latency"],
                    db_instance=db_name
                )
                self.log_event(f"Interception SUCCESS! Registered query: {sql_text[:70]}...")
                captured_count += 1
            except Exception as e:
                self.log_event(f"Failed to record captured SQL in APM tracer: {e}")

        if captured_count > 0:
            self.log_event(f"Poll completed. Registered {captured_count} new unique query/queries.")
        else:
            self.log_event("Poll completed. All scanned queries were filtered as connection noise or duplicates.")


# Global instance of the sensor
query_sensor = DBQuerySensor()
