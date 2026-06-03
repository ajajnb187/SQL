"""APM tracer for full-link API-to-SQL tracing and capturing."""

import uuid
import time
import inspect
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from src.utils.logging import get_logger

logger = get_logger(__name__)


class APMTrace(BaseModel):
    """Data model representing a captured application SQL trace."""
    
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    api_endpoint: str
    http_method: str = "POST"
    sql_statement: str
    execution_time_ms: float
    db_instance: str = "causal_inference"
    caller_file: str
    caller_line: int
    caller_function: str
    timestamp: float = Field(default_factory=time.time)


class APMTracer:
    """Manages full-link transaction tracing and SQL capture for APM diagnostics."""

    def __init__(self):
        # Memory buffer acting as a time-series storage for recent APM traces
        self._trace_buffer: List[APMTrace] = []
        logger.debug("Enterprise APM Trace Interceptor initialized")

    def capture_sql_execution(
        self,
        api_endpoint: str,
        http_method: str,
        sql_statement: str,
        execution_time_ms: float,
        db_instance: str = "causal_inference",
    ) -> APMTrace:
        """
        Intercepts and traces a SQL execution context including full calling call stack.
        
        Args:
            api_endpoint: The REST/gRPC API endpoint triggering the operation
            http_method: HTTP verb
            sql_statement: The actual SQL query sent to the database
            execution_time_ms: The physical execution latency in milliseconds
            db_instance: Target DB key/schema
        """
        # Capture stack frame to trace back to application code (e.g., ORM, service layers, MyBatis adapters)
        stack = inspect.stack()
        caller_frame = None
        
        # Walk up the stack to find the first caller outside this service library
        for frame_info in stack:
            filename = frame_info.filename
            if "enterprise_tuning_service" not in filename and "inspect" not in filename:
                caller_frame = frame_info
                break
                
        if not caller_frame:
            caller_frame = stack[1] if len(stack) > 1 else stack[0]

        trace = APMTrace(
            api_endpoint=api_endpoint,
            http_method=http_method,
            sql_statement=sql_statement,
            execution_time_ms=execution_time_ms,
            db_instance=db_instance,
            caller_file=caller_frame.filename,
            caller_line=caller_frame.lineno,
            caller_function=caller_frame.function,
        )
        
        self._trace_buffer.append(trace)
        
        # Maintain buffer size limit (e.g., latest 1000 items)
        if len(self._trace_buffer) > 1000:
            self._trace_buffer.pop(0)
            
        logger.info(
            f"APM SQL Intercepted: [{api_endpoint}] -> SQL length: {len(sql_statement)} chars | "
            f"Latency: {execution_time_ms:.2f}ms | Caller: {trace.caller_function}()"
        )
        return trace

    def get_traces(
        self,
        api_endpoint: Optional[str] = None,
        slow_only_ms: Optional[float] = None,
        db_instance: Optional[str] = None,
        limit: int = 10,
    ) -> List[APMTrace]:
        """Queries captured traces with filters for performance diagnosis."""
        filtered = self._trace_buffer
        
        if api_endpoint:
            filtered = [t for t in filtered if api_endpoint in t.api_endpoint]
        if slow_only_ms is not None:
            filtered = [t for t in filtered if t.execution_time_ms >= slow_only_ms]
        if db_instance:
            filtered = [t for t in filtered if t.db_instance == db_instance]
            
        # Return sorted by timestamp descending
        filtered.sort(key=lambda x: x.timestamp, reverse=True)
        return filtered[:limit]

    def clear_traces(self) -> None:
        """Clears trace buffer."""
        self._trace_buffer.clear()
        logger.debug("APM trace buffer cleared")


# Global singleton instance of the APM tracer
apm_tracer = APMTracer()
