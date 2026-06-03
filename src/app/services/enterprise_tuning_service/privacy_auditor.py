"""SQL Privacy Auditor for identifying data leaks and PII compliance violations."""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from src.utils.logging import get_logger
from ..text2sql_lg_service.llm_client import LLMClient

logger = get_logger(__name__)


class PrivacyAuditReport(BaseModel):
    """Data model representing a privacy auditing and compliance assessment."""
    
    is_safe: bool = Field(..., description="True if no major data leaks or plaintext PII retrieval are detected")
    risk_score: int = Field(..., description="Numeric risk level from 0 (None) to 100 (Critical)")
    PII_columns_exposed: List[str] = Field(default_factory=list, description="Plaintext PII columns exposed by this query")
    compliance_issues: List[str] = Field(default_factory=list, description="Compliance violations (e.g., GDPR, PIPEDA, HIPAA, data minimisation)")
    recommended_remediation: str = Field(..., description="Actionable query rewrite or masking advice")


class PrivacyAuditor:
    """Security Auditor auditing database queries for data leakage and privacy risks."""

    SYSTEM_PROMPT = """
    You are an expert Data Security Architect and Privacy Compliance Auditor (GDPR / HIPAA / PIPEDA).
    Your task is to analyze SQL queries and determine if they pose any privacy or data leakage risks.

    Privacy risk categories:
    - retrieval of Plaintext PII (Personally Identifiable Information) such as: phone, email, password, ssn, card, address, token, etc. without hashing/masking functions (e.g. SHA256, MD5, or SUBSTRING/masking).
    - Unbounded queries (No LIMIT, No WHERE clause) on tables that might contain sensitive customer metrics.
    - Lack of data minimization: retrieving far more columns/rows than necessary for a basic business metric.

    You must analyze the query and respond with a single, highly structured JSON object matching the requested fields, with no markdown code blocks outside the JSON itself.
    """

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm_client = llm_client or LLMClient()
        logger.debug("Privacy Auditor initialized")

    def audit_query(self, sql_query: str) -> PrivacyAuditReport:
        """
        Audits a SQL query for PII leaks and security violations.
        
        Args:
            sql_query: The SQL query to inspect
        """
        user_prompt = f"""
        SQL Query to Audit:
        ```sql
        {sql_query}
        ```
        
        Analyze this query and return your privacy audit report as a raw JSON matching this structure:
        {{
            "is_safe": [true/false],
            "risk_score": [int between 0 and 100],
            "PII_columns_exposed": ["column_name_1", "column_name_2"],
            "compliance_issues": [
                "Plaintext phone numbers are fetched without SHA256 hashing (PIPEDA/GDPR breach)",
                "Full table scan lacks filtering, exposing complete customer index"
            ],
            "recommended_remediation": "[Clean DBA advice on how to rewrite the query using MD5/SHA256 hashing, masking, or data truncation to keep it secure]"
        }}
        
        Ensure your response is ONLY the raw JSON object, valid and parsable. Do not wrap it in ```json blocks or add conversational text.
        """
        
        logger.info(f"Auditing privacy compliance for query of length {len(sql_query)}")
        
        try:
            response_text = self.llm_client.generate_completion(
                system_prompt=self.SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.1,  # Low temperature for highly precise security audits
            )
            
            # Clean possible markdown wrap from the LLM output
            cleaned_text = response_text.strip()
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:]
            elif cleaned_text.startswith("```"):
                cleaned_text = cleaned_text[3:]
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]
            cleaned_text = cleaned_text.strip()
            
            import json
            data = json.loads(cleaned_text)
            
            report = PrivacyAuditReport(
                is_safe=data.get("is_safe", True),
                risk_score=data.get("risk_score", 0),
                PII_columns_exposed=data.get("PII_columns_exposed", []),
                compliance_issues=data.get("compliance_issues", []),
                recommended_remediation=data.get("recommended_remediation", "Query is secure."),
            )
            
            logger.info(f"Privacy audit complete. Risk score: {report.risk_score}/100. Safe: {report.is_safe}")
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate privacy compliance audit: {e}")
            # Safe fallback if JSON parsing fails
            return PrivacyAuditReport(
                is_safe=True,
                risk_score=0,
                PII_columns_exposed=[],
                compliance_issues=[f"Security audit scanner failed: {str(e)}"],
                recommended_remediation="Run manual security clearance.",
            )
