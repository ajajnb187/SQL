"""API endpoints for Text2SQL LangGraph service."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from src.utils.logging import get_logger
from src.core.lifetime import get_text2sql_service, get_database_client
from src.app.services.text2sql_lg_service.exceptions import Text2SQLException, DatabaseConnectionException
from src.app.services.enterprise_tuning_service import (
    APMTracer, SQLTuner, PrivacyAuditor, SQLTuningHarness, SQLGovernanceBoard,
)

logger = get_logger(__name__)

router = APIRouter()

# Thread pool for running sync operations
_executor = ThreadPoolExecutor(max_workers=4)


class Text2SQLRequestModel(BaseModel):
    """Request model for Text2SQL API endpoint."""
    
    input_text: str = Field(
        ...,
        description="Natural language question/query to convert to SQL",
        min_length=1,
        max_length=1000,
        example="How do historical sales compare to current year sales for the Beverages category?"
    )
    max_iterations: Optional[int] = Field(
        default=3,
        description="Maximum number of SQL generation iterations",
        ge=1,
        le=10,
        example=3
    )
    metadata_path: Optional[str] = Field(
        default=None,
        description="Optional path to metadata file (defaults to default metadata)",
        example=None
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "input_text": "How do historical sales compare to current year sales for the Beverages category?",
                "max_iterations": 3,
                "metadata_path": None
            }
        }


class Text2SQLResponseModel(BaseModel):
    """Response model for Text2SQL API endpoint."""
    
    success: bool = Field(..., description="Whether the request was successful")
    sql_query: str = Field(..., description="Generated SQL query")
    data: List[Dict[str, Any]] = Field(..., description="Query execution results")
    summary: str = Field(..., description="Summary of the query results")
    followup_questions: List[str] = Field(..., description="Suggested followup questions")
    chart: Optional[str] = Field(default=None, description="Chart data (placeholder)")
    metadata: Optional[str] = Field(default=None, description="Database metadata used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "sql_query": "SELECT * FROM causal_inference.sales WHERE category = 'Beverages'",
                "data": [{"sales": 1000, "category": "Beverages"}],
                "summary": "The query returned sales data for Beverages category...",
                "followup_questions": [
                    "What are the top performing products?",
                    "How do sales vary by store?",
                    "What is the sales trend over time?"
                ],
                "chart": None,
                "metadata": None
            }
        }


@router.post(
    "/text2sql",
    response_model=Text2SQLResponseModel,
    status_code=status.HTTP_200_OK,
    summary="Convert natural language to SQL and execute query",
    description="""
    This endpoint converts a natural language question into a SQL query,
    validates it, executes it against the database, and returns the results
    along with a summary and followup questions.
    
    The workflow includes:
    1. Loading database metadata
    2. Generating SQL from natural language
    3. Validating the SQL query
    4. Executing the query
    5. Generating a summary of results
    6. Generating followup questions
    """,
    responses={
        200: {
            "description": "Successful response",
            "model": Text2SQLResponseModel
        },
        400: {
            "description": "Bad request - Invalid input or SQL execution error"
        },
        422: {
            "description": "Validation error"
        },
        500: {
            "description": "Internal server error"
        },
        502: {
            "description": "LLM service error"
        },
        503: {
            "description": "Database connection error"
        }
    }
)
async def text2sql(request: Text2SQLRequestModel) -> Text2SQLResponseModel:
    """
    Convert natural language to SQL and execute query.

    Args:
        request: Text2SQL request containing input text and optional parameters

    Returns:
        Text2SQLResponseModel with SQL query, results, summary, and followup questions

    Raises:
        HTTPException: If processing fails
    """
    try:
        logger.info(
            f"Received Text2SQL request: {request.input_text[:100]}...",
            extra={
                "max_iterations": request.max_iterations,
                "has_metadata_path": request.metadata_path is not None
            }
        )

        # Get singleton service instance
        service = get_text2sql_service()

        # Run sync operation in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            _executor,
            lambda: service.process_query(
                input_text=request.input_text,
                max_iterations=request.max_iterations or 3,
                metadata_path=request.metadata_path,
            )
        )

        # Convert to response model
        result = Text2SQLResponseModel(
            success=True,
            sql_query=response.sql_query,
            data=response.data,
            summary=response.summary,
            followup_questions=response.followup_questions,
            chart=response.chart,
            metadata=response.metadata,
        )
        
        logger.info(
            "Text2SQL request processed successfully",
            extra={
                "sql_query_length": len(response.sql_query),
                "data_rows": len(response.data),
                "followup_questions_count": len(response.followup_questions)
            }
        )
        
        return result
    
    except Text2SQLException as e:
        logger.error(
            f"Text2SQL error: {e.message}",
            extra={
                "error_code": e.error_code,
                "status_code": e.status_code,
                "details": e.details
            }
        )
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "error": e.message,
                "error_code": e.error_code,
                "details": e.details
            }
        )
    
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": str(e),
                "error_code": "VALIDATION_ERROR"
            }
        )
    
    except Exception as e:
        logger.error(
            f"Unexpected error processing Text2SQL request: {e}",
            extra={"error_type": type(e).__name__}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "An unexpected error occurred while processing the request",
                "error_code": "INTERNAL_ERROR"
            }
        )


@router.get(
    "/health",
    summary="Health check endpoint",
    description="Check if the Text2SQL service is available"
)
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint.

    Returns:
        Dictionary with service status including database connectivity
    """
    try:
        logger.debug("Health check requested")

        # Check database connectivity
        db_status = "unknown"
        try:
            db_client = get_database_client()
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(_executor, db_client.test_connection)
            db_status = "connected"
        except DatabaseConnectionException as e:
            db_status = f"disconnected: {e.message}"
        except RuntimeError:
            db_status = "not initialized"
        except Exception as e:
            db_status = f"error: {str(e)}"

        # Check service availability
        service_status = "unknown"
        try:
            get_text2sql_service()
            service_status = "available"
        except RuntimeError:
            service_status = "not initialized"

        is_healthy = db_status == "connected" and service_status == "available"

        return {
            "status": "healthy" if is_healthy else "degraded",
            "service": "text2sql_lg_code",
            "version": "1.0",
            "checks": {
                "database": db_status,
                "text2sql_service": service_status,
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "Service unavailable", "details": str(e)}
        )


# --- Enterprise APM & Tuning Lazy-Singletons ---
_apm_tracer = None
_sql_tuner = None
_privacy_auditor = None
_tuning_harness = None
_governance_board = None

from src.app.services.enterprise_tuning_service.multi_db_manager import db_manager, DynamicDatabaseClient

class DBConnectRequest(BaseModel):
    dialect: str = Field(..., description="postgresql or mysql")
    host: str = Field("localhost", description="Database hostname")
    port: int = Field(5432, description="Database port number")
    dbname: str = Field(..., description="Database schema/name")
    username: str = Field(..., description="Username")
    password: str = Field("", description="Password")

class APMCollectRequest(BaseModel):
    endpoint: str
    method: str
    sql_statement: str
    execution_time_ms: float
    db_instance: str
    caller_file: Optional[str] = None
    caller_line: Optional[int] = None
    caller_function: Optional[str] = None

class AntiPatternAuditRequest(BaseModel):
    sql_query: str

def get_apm_tracer():
    from src.app.services.enterprise_tuning_service import apm_tracer
    return apm_tracer

def get_sql_tuner():
    global _sql_tuner
    if _sql_tuner is None:
        _sql_tuner = SQLTuner()
    return _sql_tuner

def get_privacy_auditor():
    global _privacy_auditor
    if _privacy_auditor is None:
        _privacy_auditor = PrivacyAuditor()
    return _privacy_auditor

def get_tuning_harness():
    global _tuning_harness
    if _tuning_harness is None:
        _tuning_harness = SQLTuningHarness()
    return _tuning_harness

def get_governance_board():
    global _governance_board
    if _governance_board is None:
        # Reuse the existing specialist singletons so the board shares their state/LLM client.
        _governance_board = SQLGovernanceBoard(
            sql_tuner=get_sql_tuner(),
            privacy_auditor=get_privacy_auditor(),
            tuning_harness=get_tuning_harness(),
        )
    return _governance_board


def _fetch_explain_plan_sync(sql: str) -> str:
    """Best-effort EXPLAIN plan fetch from the active DB (returns a note on failure)."""
    db_client = get_database_client()
    try:
        with db_client.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(f"EXPLAIN {sql}")
                rows = cursor.fetchall()
                if getattr(db_client, "dialect", "postgresql") == "mysql":
                    formatted = []
                    for r in rows:
                        if isinstance(r, dict):
                            formatted.append(", ".join(f"{k}: {v}" for k, v in r.items()))
                        else:
                            formatted.append(", ".join(str(val) for val in r))
                    return "\n".join(formatted)
                return "\n".join(str(r[0]) for r in rows)
    except Exception as e:
        logger.warning(f"Failed to fetch explain plan: {e}")
        return f"Explain Plan not available: {str(e)}"


class OptimizeRequestModel(BaseModel):
    sql_query: str = Field(..., description="The original SQL statement to tune and audit")


@router.get(
    "/enterprise/apm/traces",
    summary="Get recent APM traces",
    description="Retrieve captured full-link application API-to-SQL execution transaction logs."
)
async def list_traces(limit: int = 15) -> List[Dict[str, Any]]:
    try:
        tracer = get_apm_tracer()
        traces = tracer.get_traces(limit=limit)
        return [t.model_dump() for t in traces]
    except Exception as e:
        logger.error(f"Failed to list APM traces: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"Failed to list traces: {str(e)}"}
        )


class BenchmarkRequestModel(BaseModel):
    original_sql: str = Field(..., description="The original SQL statement")
    optimized_sql: str = Field(..., description="The optimized rewritten SQL statement")
    suggested_indexes: List[str] = Field(default_factory=list, description="List of index DDL statements to test")


@router.post(
    "/enterprise/tuning/optimize",
    summary="Stage 1: Analyze and Propose Optimizations",
    description="Submits query to fetch explain plan, triggers AI-tuning rewrite in Chinese, and PII compliance audit. No sandbox run yet."
)
async def optimize_query_endpoint(request: OptimizeRequestModel) -> Dict[str, Any]:
    try:
        sql = request.sql_query.strip()
        if not sql:
            raise ValueError("sql_query cannot be empty")
            
        # 1. Fetch Explain Plan safely from current connected database
        db_client = get_database_client()
        db_type = "MySQL" if db_client.dialect == "mysql" else "PostgreSQL"
        explain_plan = ""
        try:
            loop = asyncio.get_event_loop()
            
            def fetch_explain():
                with db_client.get_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(f"EXPLAIN {sql}")
                        rows = cursor.fetchall()
                        if db_client.dialect == "mysql":
                            formatted = []
                            for r in rows:
                                if isinstance(r, dict):
                                    formatted.append(", ".join(f"{k}: {v}" for k, v in r.items()))
                                else:
                                    formatted.append(", ".join(str(val) for val in r))
                            return "\n".join(formatted)
                        else:
                            return "\n".join([str(r[0]) for r in rows])
                        
            explain_plan = await loop.run_in_executor(_executor, fetch_explain)
        except Exception as e:
            logger.warning(f"Failed to fetch explain plan: {e}")
            explain_plan = f"Explain Plan not available: {str(e)}"

        # 2. Run AI SQLTuner (using ThreadPool to prevent blocking)
        tuner = get_sql_tuner()
        loop = asyncio.get_event_loop()
        tuning_rec = await loop.run_in_executor(
            _executor, 
            lambda: tuner.optimize_query(sql, explain_plan, db_type=db_type)
        )

        # 3. Run Privacy Compliance Auditor
        auditor = get_privacy_auditor()
        privacy_report = await loop.run_in_executor(
            _executor,
            lambda: auditor.audit_query(sql)
        )

        return {
            "success": True,
            "explain_plan": explain_plan,
            "tuning_recommendation": tuning_rec.model_dump(),
            "privacy_report": privacy_report.model_dump()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": str(e)})
    except Exception as e:
        logger.error(f"Optimization analysis endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"Failed to analyze query: {str(e)}"}
        )


@router.post(
    "/enterprise/tuning/benchmark",
    summary="Stage 2: Run Sandbox Transaction Benchmark",
    description="Applies selected indexes, executes original vs optimized SQL queries in a read-only transaction sandbox, and reports precise speedup metrics."
)
async def benchmark_query_endpoint(request: BenchmarkRequestModel) -> Dict[str, Any]:
    try:
        orig_sql = request.original_sql.strip()
        opt_sql = request.optimized_sql.strip()
        indexes = request.suggested_indexes
        
        if not orig_sql:
            raise ValueError("original_sql cannot be empty")
            
        loop = asyncio.get_event_loop()
        
        # Execute Transaction Sandbox Performance Evaluation Harness
        harness = get_tuning_harness()
        harness_report = await loop.run_in_executor(
            _executor,
            lambda: harness.evaluate_tuning(orig_sql, opt_sql, indexes)
        )
        
        # Register this benchmark run in APM traces for real-time visualization!
        tracer = get_apm_tracer()
        tracer.capture_sql_execution(
            api_endpoint="/api/text2sql_lg_code/enterprise/tuning/benchmark",
            http_method="POST",
            sql_statement=orig_sql,
            execution_time_ms=harness_report.original_latency_ms,
            db_instance="causal_inference"
        )

        return {
            "success": True,
            "performance_report": harness_report.model_dump()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": str(e)})
    except Exception as e:
        logger.error(f"Tuning benchmark endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"Failed to benchmark query: {str(e)}"}
        )


@router.post(
    "/enterprise/db/connect",
    summary="Connect and switch database context",
    description="Allows dynamic switching to any local/remote PostgreSQL or MySQL database."
)
async def connect_dynamic_db(req: DBConnectRequest):
    try:
        # Create and verify connection
        client = db_manager.set_active_connection(
            dialect=req.dialect,
            host=req.host,
            port=req.port,
            dbname=req.dbname,
            username=req.username,
            password=req.password
        )
        return {
            "success": True,
            "message": f"成功连接并切换至 [{req.dialect.upper()}] 数据库: {req.dbname} ({req.host}:{req.port})",
            "active_db": {
                "dialect": req.dialect,
                "host": req.host,
                "port": req.port,
                "dbname": req.dbname,
                "username": req.username
            }
        }
    except Exception as e:
        logger.error(f"Dynamic DB connection failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": f"数据库连接失败: {str(e)}"}
        )


@router.get(
    "/enterprise/db/status",
    summary="Get active database connection status"
)
async def get_db_status():
    client = get_database_client()
    is_dynamic = hasattr(client, "dialect")
    return {
        "success": True,
        "is_dynamic_override": is_dynamic,
        "dialect": getattr(client, "dialect", "postgresql"),
        "host": getattr(client, "host", "localhost"),
        "port": getattr(client, "port", 5432),
        "dbname": getattr(client, "dbname", "postgres"),
        "username": getattr(client, "username", "postgres")
    }


@router.post(
    "/enterprise/db/reset",
    summary="Revert to default local PostgreSQL database"
)
async def reset_db_connection():
    db_manager.reset_to_default()
    return {
        "success": True,
        "message": "成功还原至系统默认的本地 PostgreSQL 数据库。"
    }


@router.get(
    "/enterprise/db/tables",
    summary="List tables and schema of active database connection"
)
async def get_db_tables():
    try:
        client = get_database_client()
        if hasattr(client, "get_tables_and_columns"):
            loop = asyncio.get_event_loop()
            columns = await loop.run_in_executor(_executor, client.get_tables_and_columns)
            
            # Group by table_name
            tables = {}
            for col in columns:
                tbl = col["table_name"]
                if tbl not in tables:
                    tables[tbl] = []
                tables[tbl].append({
                    "column_name": col["column_name"],
                    "data_type": col["data_type"],
                    "is_nullable": col["is_nullable"]
                })
            
            return {
                "success": True,
                "tables_count": len(tables),
                "tables": tables
            }
        else:
            return {
                "success": False,
                "message": "当前数据库客户端不支持直接元数据查询。"
            }
    except Exception as e:
        logger.error(f"Failed to fetch metadata schema: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"读取元数据失败: {str(e)}"}
        )


@router.post(
    "/enterprise/apm/collect",
    summary="Ingest external application SQL execution telemetry",
    description="A real-time REST endpoint that any external system or middleware can hit to report query telemetry!"
)
async def collect_apm_trace(req: APMCollectRequest):
    try:
        tracer = get_apm_tracer()
        trace = tracer.capture_sql_execution(
            api_endpoint=req.endpoint,
            http_method=req.method,
            sql_statement=req.sql_statement,
            execution_time_ms=req.execution_time_ms,
            db_instance=req.db_instance
        )
        if req.caller_file:
            trace.caller_file = req.caller_file
        if req.caller_line:
            trace.caller_line = req.caller_line
        if req.caller_function:
            trace.caller_function = req.caller_function
            
        return {
            "success": True,
            "message": "APM 慢 SQL 监控上报成功",
            "trace_id": trace.trace_id
        }
    except Exception as e:
        logger.error(f"Failed to ingest APM trace: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"上报失败: {str(e)}"}
        )


@router.get(
    "/enterprise/apm/sensor-logs",
    summary="Get background sensor execution logs"
)
async def get_sensor_logs() -> List[str]:
    try:
        from src.app.services.enterprise_tuning_service import query_sensor
        logger.info(f"Retrieving sensor logs: {query_sensor.logs}")
        return query_sensor.logs if query_sensor.logs is not None else ["Sensor logs array is None!"]
    except Exception as e:
        logger.error(f"Failed to fetch sensor logs: {e}")
        return [f"Failed to fetch logs: {e}"]


@router.post(
    "/enterprise/tuning/anti-patterns",
    summary="Perform comprehensive static and AI SQL anti-pattern auditing",
    description="Audits queries for SELECT *, missing limit, non-sargable WHERE, locking issues, and cartesian joins."
)
async def audit_sql_anti_patterns(req: AntiPatternAuditRequest):
    sql = req.sql_query.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")
        
    static_issues = []
    
    # Static Audit Rule 1: SELECT * check
    import re
    if re.search(r"SELECT\s+\*\s+FROM", sql, re.IGNORECASE):
        static_issues.append({
            "rule": "SELECT * 反模式 (SELECT * Over-fetching)",
            "severity": "MEDIUM",
            "description": "检测到使用 'SELECT *'，会导致不必要的数据列加载与传输，极易引发大量磁盘 I/O 且无法运用覆盖索引覆盖（Index-Only Scan）优化。推荐明确列出需要检索的字段名称。"
        })
        
    # Static Audit Rule 2: Missing pagination LIMIT check (only if it starts with SELECT)
    if sql.upper().startswith("SELECT") and not re.search(r"\bLIMIT\b", sql, re.IGNORECASE):
        static_issues.append({
            "rule": "缺少分页限制 (Missing LIMIT/Pagination)",
            "severity": "HIGH",
            "description": "未检测到 LIMIT 语句。这在处理高基数大表时会导致服务端尝试加载并返回数百万行数据，严重污染数据库 Buffer Pool 并可能直接引发 JVM/App 容器 OutOfMemory (OOM) 崩溃。建议强行加分页限制。"
        })
        
    # Static Audit Rule 3: LIKE wildcard prefix check
    if re.search(r"LIKE\s+['\"][^'\"%]*%", sql, re.IGNORECASE) and not re.search(r"LIKE\s+['\"]%", sql, re.IGNORECASE):
        pass # leading wildcard is fine
    if re.search(r"LIKE\s+['\"]%", sql, re.IGNORECASE):
        static_issues.append({
            "rule": "前缀模糊查询反模式 (Leading Wildcard LIKE '%...')",
            "severity": "HIGH",
            "description": "检测到 'LIKE %...'（前置百分号模糊查询）。由于 B-Tree 索引是按字符从左到右检索，前置通配符会导致索引彻底失效（No-Sargable），数据库被迫对整张表进行全表扫描。推荐使用全文搜索引擎或更换匹配策略。"
        })

    # Static Audit Rule 4: Explicit locking check
    if re.search(r"\bFOR\s+UPDATE\b|\bLOCK\b", sql, re.IGNORECASE):
        static_issues.append({
            "rule": "排他性悲观锁隐患 (Explicit Table/Row Locking)",
            "severity": "HIGH",
            "description": "检测到使用 FOR UPDATE 或显式排他锁。此类悲观锁在高并发环境下容易产生长期事务阻塞、线程池爆满、甚至致命的死锁（Deadlocks）。如必须使用，请确保过滤条件高精度走索引，且设置 NOWAIT 或超时限制。"
        })

    # Static Audit Rule 5: Cartesian Join product check
    if re.search(r"CROSS\s+JOIN", sql, re.IGNORECASE) or (re.search(r",", sql.split("WHERE")[0]) if "WHERE" in sql.upper() else False):
        static_issues.append({
            "rule": "笛卡尔积乘积关联 (Potential Cartesian Product Join)",
            "severity": "HIGH",
            "description": "检测到可能存在的隐式多表 Comma 关联或 CROSS JOIN。如果缺少关联 ON 键或 WHERE 连表过滤，会产生极高维度的笛卡尔积大扫描，使结果集指数级膨胀，造成 CPU 跑满和临时盘溢出。推荐强制改写为 INNER JOIN...ON 的规范格式。"
        })

    # Use LLM to perform advanced semantic review as DBA expert
    tuner = get_sql_tuner()
    ai_prompt = f"""
    您是一位高级 DBA 专家。请对以下 SQL 语句进行深度调优诊断和结构审查，针对索引设计、不规范的 WHERE 函数操作、隐式类型转换、连表深度以及死锁高风险等进行调优指导：
    
    待审核 SQL：
    ```sql
    {sql}
    ```
    
    请输出三个简明扼要的专业调优策略（全中文格式，以 JSON 数组返回，不要包含其他解释，每项包含 title、severity (HIGH/MEDIUM/LOW)、和 solution 三个字段）：
    格式示范：
    [
        {{
            "title": "关联字段未建立索引",
            "severity": "HIGH",
            "solution": "请在 xxx 表的 yyy 关联键上建立 B-Tree 索引以避免 Nested Loop 慢扫描。"
        }}
    ]
    """
    
    ai_issues = []
    try:
        loop = asyncio.get_event_loop()
        res_text = await loop.run_in_executor(
            _executor,
            lambda: tuner.llm_client.generate_completion(
                system_prompt="You are an expert DBA auditor. Answer in raw JSON array only.",
                user_prompt=ai_prompt,
                temperature=0.1
            )
        )
        cleaned_text = res_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        elif cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()
        
        import json
        ai_issues = json.loads(cleaned_text)
    except Exception as e:
        logger.warning(f"AI anti-pattern audit failed: {e}")
        ai_issues = [{
            "title": "AI 调优引擎审查中置",
            "severity": "LOW",
            "solution": f"AI 分析未完全返回，请检查网络或 LLM 配置。基础静态规则已生效。细节：{str(e)}"
        }]

    return {
        "success": True,
        "sql": sql,
        "static_issues": static_issues,
        "ai_issues": ai_issues,
        "overall_health_score": max(20, 100 - (len(static_issues) * 20) - (len(ai_issues) * 15))
    }


class GovernanceReviewRequest(BaseModel):
    sql_query: str = Field(..., description="The SQL statement to submit for multi-agent board review")
    run_sandbox: bool = Field(
        default=False,
        description="If true, also run the transactional sandbox benchmark agent (slower)."
    )


@router.post(
    "/enterprise/agents/review",
    summary="Multi-agent SQL Governance Board review",
    description=(
        "Coordinates specialist AI agents (Performance / Security & Compliance / "
        "Anti-Pattern / optional Sandbox) under a Supervisor that returns one "
        "consolidated verdict, risk score, and prioritized action items in Chinese."
    ),
)
async def governance_board_review(request: GovernanceReviewRequest) -> Dict[str, Any]:
    try:
        sql = request.sql_query.strip()
        if not sql:
            raise ValueError("sql_query cannot be empty")

        db_client = get_database_client()
        db_type = "MySQL" if getattr(db_client, "dialect", "postgresql") == "mysql" else "PostgreSQL"

        loop = asyncio.get_event_loop()
        explain_plan = await loop.run_in_executor(_executor, _fetch_explain_plan_sync, sql)

        board = get_governance_board()
        report = await loop.run_in_executor(
            _executor,
            lambda: board.review(sql, explain_plan=explain_plan, db_type=db_type, run_sandbox=request.run_sandbox),
        )

        # Surface this board review in the APM timeline for real-time visibility.
        try:
            get_apm_tracer().capture_sql_execution(
                api_endpoint="/api/text2sql_lg_code/enterprise/agents/review",
                http_method="POST",
                sql_statement=sql,
                execution_time_ms=0.0,
                db_instance=getattr(db_client, "dbname", "causal_inference"),
            )
        except Exception as trace_err:
            logger.debug(f"Board review APM capture skipped: {trace_err}")

        return {"success": True, "explain_plan": explain_plan, "report": report.model_dump()}

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": str(e)})
    except Exception as e:
        logger.error(f"Governance board review endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"Failed to run governance review: {str(e)}"}
        )

