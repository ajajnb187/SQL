from contextlib import asynccontextmanager
from fastapi import FastAPI
from httpx import AsyncClient
from src.utils.logging import get_logger
from src.app.services.text2sql_lg_service import Text2SQLService
from src.app.services.text2sql_lg_service.database_client import DatabaseClient

logger = get_logger(__name__)


# Global singleton instances
_text2sql_service: Text2SQLService | None = None
_database_client: DatabaseClient | None = None


def get_text2sql_service() -> Text2SQLService:
    """Get the singleton Text2SQL service instance."""
    global _text2sql_service
    if _text2sql_service is None:
        raise RuntimeError("Text2SQL service not initialized. Application not started properly.")
    return _text2sql_service


def get_database_client():
    """Get the active database client instance (supports dynamic overrides)."""
    global _database_client
    from src.app.services.enterprise_tuning_service.multi_db_manager import db_manager
    if _database_client is None:
        raise RuntimeError("Database client not initialized. Application not started properly.")
    return db_manager.get_client()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages FastAPI application lifespan events."""
    global _text2sql_service, _database_client
    try:
        logger.info("Initializing HTTPX AsyncClient on startup")
        app.state.httpx_client = AsyncClient()
        logger.debug("HTTPX AsyncClient initialized successfully")

        # Initialize database client singleton
        logger.info("Initializing Database client on startup")
        _database_client = DatabaseClient()
        from src.app.services.enterprise_tuning_service.multi_db_manager import db_manager
        db_manager.set_default_client(_database_client)
        app.state.database_client = _database_client
        logger.debug("Database client initialized successfully")

        # Initialize Text2SQL service singleton
        logger.info("Initializing Text2SQL service on startup")
        _text2sql_service = Text2SQLService()
        app.state.text2sql_service = _text2sql_service
        logger.debug("Text2SQL service initialized successfully")

        # Start the background Database Zero-Invasive Query Sensor Agent
        logger.info("Starting background Database Query Sensor Agent on startup")
        from src.app.services.enterprise_tuning_service import query_sensor
        query_sensor.start()

    except Exception as e:
        logger.error(f"Failed to initialize application resources: {str(e)}")
        raise

    yield  # Hand over control to FastAPI

    # This runs AFTER shutdown
    try:
        # Stop background query sensor agent
        logger.info("Stopping background Database Query Sensor Agent on shutdown")
        try:
            from src.app.services.enterprise_tuning_service import query_sensor
            query_sensor.stop()
        except Exception as e:
            logger.warning(f"Failed to stop Database Query Sensor Agent: {e}")

        logger.info("Closing HTTPX AsyncClient on shutdown")
        if hasattr(app.state, 'httpx_client') and app.state.httpx_client:
            await app.state.httpx_client.aclose()
            logger.debug("HTTPX AsyncClient closed successfully")

        # Close database connections
        logger.info("Closing database connections on shutdown")
        if _database_client:
            _database_client.close()
            _database_client = None
            logger.debug("Database connections closed successfully")

        # Clear service reference
        _text2sql_service = None

    except Exception as e:
        logger.error(f"Failed to close resources: {str(e)}")
