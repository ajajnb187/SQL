"""Multi-Database Connection Manager supporting PostgreSQL and MySQL (local/remote)."""

import os
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
import psycopg2
from psycopg2.extras import RealDictCursor
import pymysql
import pymysql.cursors

from src.utils.logging import get_logger

logger = get_logger(__name__)


class DynamicDatabaseClient:
    """A dynamic database client wrapper that supports both PostgreSQL and MySQL connections."""

    def __init__(
        self,
        dialect: str = "postgresql",  # postgresql or mysql
        host: str = "localhost",
        port: int = 5432,
        dbname: str = "postgres",
        username: str = "postgres",
        password: str = "",
    ):
        self.dialect = dialect.lower().strip()
        self.host = host
        self.port = int(port)
        self.dbname = dbname
        self.username = username
        self.password = password
        self._pg_pool = None
        self._mysql_conn = None

        logger.info(f"Initializing DynamicDatabaseClient: Dialect={self.dialect}, Host={self.host}:{self.port}, DB={self.dbname}")

    def test_connection(self) -> bool:
        """Test if connection can be successfully established."""
        if self.dialect == "postgresql":
            conn = None
            try:
                conn = psycopg2.connect(
                    host=self.host,
                    port=self.port,
                    dbname=self.dbname,
                    user=self.username,
                    password=self.password,
                    connect_timeout=5
                )
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1;")
                    cursor.fetchone()
                return True
            except Exception as e:
                logger.error(f"PostgreSQL connection test failed: {e}")
                raise RuntimeError(f"PostgreSQL 连接失败: {str(e)}")
            finally:
                if conn:
                    conn.close()
        elif self.dialect == "mysql":
            conn = None
            try:
                conn = pymysql.connect(
                    host=self.host,
                    port=self.port,
                    database=self.dbname,
                    user=self.username,
                    password=self.password,
                    connect_timeout=5
                )
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1;")
                    cursor.fetchone()
                return True
            except Exception as e:
                logger.error(f"MySQL connection test failed: {e}")
                raise RuntimeError(f"MySQL 连接失败: {str(e)}")
            finally:
                if conn:
                    conn.close()
        else:
            raise ValueError(f"Unsupported database dialect: {self.dialect}")

    @contextmanager
    def get_connection(self):
        """Standardized PEP 249 Connection context manager for both PostgreSQL and MySQL transaction evaluations."""
        conn = None
        try:
            if self.dialect == "postgresql":
                conn = psycopg2.connect(
                    host=self.host,
                    port=self.port,
                    dbname=self.dbname,
                    user=self.username,
                    password=self.password
                )
            elif self.dialect == "mysql":
                conn = pymysql.connect(
                    host=self.host,
                    port=self.port,
                    database=self.dbname,
                    user=self.username,
                    password=self.password,
                    connect_timeout=3,
                    read_timeout=3
                )
            else:
                raise ValueError(f"Unsupported dialect: {self.dialect}")
            yield conn
        except Exception as e:
            logger.error(f"DynamicDatabaseClient connection error: {e}")
            raise e
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass

    def execute_query(self, sql_query: str, fetch_all: bool = True) -> List[Dict[str, Any]]:
        """Executes query and returns rows as dictionaries."""
        if not sql_query or not sql_query.strip():
            return []

        if self.dialect == "postgresql":
            conn = None
            try:
                conn = psycopg2.connect(
                    host=self.host,
                    port=self.port,
                    dbname=self.dbname,
                    user=self.username,
                    password=self.password
                )
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(sql_query)
                    if fetch_all:
                        try:
                            rows = cursor.fetchall()
                            results = [dict(row) for row in rows]
                        except Exception:
                            # In case query has no rows (like INSERT/UPDATE/DDL)
                            results = []
                    else:
                        results = []
                    conn.commit()
                    return results
            except Exception as e:
                if conn:
                    conn.rollback()
                logger.error(f"PostgreSQL query execution failed: {e}")
                raise e
            finally:
                if conn:
                    conn.close()

        elif self.dialect == "mysql":
            conn = None
            try:
                conn = pymysql.connect(
                    host=self.host,
                    port=self.port,
                    database=self.dbname,
                    user=self.username,
                    password=self.password,
                    cursorclass=pymysql.cursors.DictCursor,
                    connect_timeout=3,
                    read_timeout=3
                )
                with conn.cursor() as cursor:
                    cursor.execute(sql_query)
                    if fetch_all:
                        try:
                            results = list(cursor.fetchall())
                        except Exception:
                            results = []
                    else:
                        results = []
                    conn.commit()
                    return results
            except Exception as e:
                if conn:
                    conn.rollback()
                logger.error(f"MySQL query execution failed: {e}")
                raise e
            finally:
                if conn:
                    conn.close()
        else:
            raise ValueError(f"Unsupported database dialect: {self.dialect}")

    def get_explain_plan(self, sql_query: str) -> str:
        """Retrieves the EXPLAIN plan for a given query."""
        explain_sql = f"EXPLAIN {sql_query.strip()}"
        try:
            results = self.execute_query(explain_sql)
            if not results:
                return "No execution plan returned."
            
            if self.dialect == "postgresql":
                # PostgreSQL returns rows like {'QUERY PLAN': '...'}
                plan_key = list(results[0].keys())[0]
                return "\n".join([str(r[plan_key]) for r in results])
            elif self.dialect == "mysql":
                # MySQL returns columns like select_type, table, partitions, type, possible_keys, key, key_len, ref, rows, filtered, Extra
                import json
                return json.dumps(results, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to fetch execution plan: {e}")
            return f"无法获取执行计划: {str(e)}"

    def get_tables_and_columns(self) -> List[Dict[str, Any]]:
        """Introspects the database to retrieve schema tables and column metadata."""
        if self.dialect == "postgresql":
            sql = """
                SELECT 
                    table_name, 
                    column_name, 
                    data_type,
                    is_nullable
                FROM information_schema.columns 
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_name, ordinal_position;
            """
            rows = self.execute_query(sql)
            return rows
        elif self.dialect == "mysql":
            sql = f"""
                SELECT 
                    TABLE_NAME as table_name, 
                    COLUMN_NAME as column_name, 
                    DATA_TYPE as data_type,
                    IS_NULLABLE as is_nullable
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = '{self.dbname}'
                ORDER BY TABLE_NAME, ORDINAL_POSITION;
            """
            rows = self.execute_query(sql)
            return rows
        return []

    def close(self) -> None:
        """Conforms to close interface."""
        pass


class GlobalMultiDBManager:
    """Manages active dynamic connections and system-wide overrides."""

    def __init__(self):
        # Optionally pre-activate a remote database override from environment variables.
        # When ENTERPRISE_DB_DIALECT is unset, no override is applied and the system
        # falls back to the default local PostgreSQL client (set during app startup).
        # Credentials are NEVER hardcoded — configure them via .env / environment.
        self._active_client: Optional[DynamicDatabaseClient] = self._build_env_override()
        self._default_client: Optional[Any] = None

    @staticmethod
    def _build_env_override() -> Optional["DynamicDatabaseClient"]:
        """Build an initial active client from ENTERPRISE_DB_* env vars, if provided."""
        dialect = os.environ.get("ENTERPRISE_DB_DIALECT")
        if not dialect:
            return None
        try:
            default_port = 3306 if dialect.lower().strip() == "mysql" else 5432
            client = DynamicDatabaseClient(
                dialect=dialect,
                host=os.environ.get("ENTERPRISE_DB_HOST", "127.0.0.1"),
                port=int(os.environ.get("ENTERPRISE_DB_PORT", str(default_port))),
                dbname=os.environ.get("ENTERPRISE_DB_NAME", ""),
                username=os.environ.get("ENTERPRISE_DB_USER", ""),
                password=os.environ.get("ENTERPRISE_DB_PASSWORD", ""),
            )
            logger.info(
                f"Loaded enterprise DB override from environment: "
                f"{client.dialect}://{client.host}:{client.port}/{client.dbname}"
            )
            return client
        except Exception as e:
            logger.warning(f"Failed to build enterprise DB override from env, ignoring: {e}")
            return None

    def set_default_client(self, client: Any):
        self._default_client = client

    def set_active_connection(
        self,
        dialect: str,
        host: str,
        port: int,
        dbname: str,
        username: str,
        password: str,
    ) -> DynamicDatabaseClient:
        client = DynamicDatabaseClient(
            dialect=dialect,
            host=host,
            port=port,
            dbname=dbname,
            username=username,
            password=password
        )
        # Test connection first to ensure correctness
        client.test_connection()
        self._active_client = client
        return client

    def reset_to_default(self) -> None:
        self._active_client = None

    def get_client(self) -> Any:
        """Returns active overridden client, or falls back to default system PostgreSQL client."""
        if self._active_client is not None:
            return self._active_client
        return self._default_client


# Global instance of the multi-database manager
db_manager = GlobalMultiDBManager()
