---
name: sql-governance-review
description: Run a multi-agent governance board review on a SQL statement to get a consolidated verdict (APPROVED / APPROVED_WITH_CHANGES / BLOCKED), a 0-100 risk score, the recommended optimized SQL, and a prioritized Chinese action list. Use this before shipping or approving any non-trivial SQL change, when you need an all-in-one performance + security + anti-pattern review, or when asked to "审一下这条 SQL".
---

# SQL Governance Board Review (多智能体会审)

This skill submits a SQL statement to the project's multi-agent **SQL Governance Board**.
A Supervisor agent coordinates four specialists running in parallel:

- **性能调优专家** — rewrites the query and proposes indexes.
- **数据安全与合规专家** — flags PII exposure and GDPR/HIPAA/PIPEDA issues.
- **反模式审查专家** — static rules: `SELECT *`, missing `LIMIT`, leading-wildcard `LIKE`, explicit locks, cartesian joins.
- **沙盒实测专家** (optional) — measures real speedup in a rolled-back transaction.

## When to use

- Reviewing/approving a SQL change before it ships.
- You want one consolidated risk verdict instead of running tuning/audit/anti-pattern separately.
- Investigating a query flagged by APM monitoring.

## How to run

Ensure the backend is running (default `http://localhost:8090`; override via `SQL_API_BASE`).

```bash
python skills/sql-governance-review/scripts/review.py "SELECT * FROM causal_inference.sales WHERE customer_email LIKE '%@gmail.com'"
# add --sandbox to also run the transactional benchmark specialist (slower)
python skills/sql-governance-review/scripts/review.py --sandbox "<your sql>"
```

## Output

The script prints the overall verdict, risk score, supervisor consensus, each
specialist's findings, the recommended optimized SQL, and the prioritized action items.

## Interpreting the verdict

- **BLOCKED** — high security/compliance risk or high-risk anti-pattern; do not ship as-is.
- **APPROVED_WITH_CHANGES** — apply the action items (usually performance/medium risk).
- **APPROVED** — safe to proceed.
