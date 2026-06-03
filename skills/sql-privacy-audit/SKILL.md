---
name: sql-privacy-audit
description: Audit a SQL query for data privacy and compliance risks — plaintext PII retrieval (email, phone, ssn, card, token...), unbounded scans of sensitive tables, and GDPR/HIPAA/PIPEDA violations. Returns is_safe, a 0-100 risk score, exposed PII columns, compliance issues, and remediation advice. Use when handling customer/PII data or when asked to check a query for "安全隐患/合规/隐私".
---

# SQL Privacy & Compliance Audit (隐私合规审计)

Wraps the project's `PrivacyAuditor` to detect data-leak and compliance risks in a SQL query.

## When to use

- The query touches customer data or potential PII columns.
- You need a security/compliance sign-off (not performance).
- A reviewer asks whether a query is safe to run in production.

## How to run

Backend must be running (`SQL_API_BASE`, default `http://localhost:8090`).

```bash
python skills/sql-privacy-audit/scripts/audit.py "SELECT customer_email, phone FROM causal_inference.sales"
```

## Output

Prints `is_safe`, the risk score (0-100), the exposed PII columns, the list of
compliance issues, and concrete remediation advice (hashing/masking/truncation).

## Note

This uses the same backend stage-1 endpoint as tuning, reading the `privacy_report`
field. For a single all-in-one verdict combining privacy with performance and
anti-patterns, use the `sql-governance-review` skill.
