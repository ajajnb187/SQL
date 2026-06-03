---
name: sql-anti-pattern-audit
description: Review a SQL query for well-known anti-patterns using both deterministic static rules (SELECT *, missing LIMIT, leading-wildcard LIKE, explicit FOR UPDATE locks, cartesian joins) and an AI DBA semantic review (non-sargable WHERE, missing join indexes, implicit type casts, deadlock risk). Returns issues with severity and a health score. Use for quick SQL code-review / linting before a query ships.
---

# SQL Anti-Pattern Audit (反模式审查)

Combines fast static rules with an LLM DBA semantic review for SQL code-review.

## When to use

- Linting a query during code review.
- You want quick structural feedback without fetching an EXPLAIN plan.
- Catching `SELECT *`, missing pagination, index-defeating predicates, locking and
  cartesian-join risks.

## How to run

Backend must be running (`SQL_API_BASE`, default `http://localhost:8090`).

```bash
python skills/sql-anti-pattern-audit/scripts/audit.py "SELECT * FROM causal_inference.sales s WHERE s.category_name LIKE '%Electronic%'"
```

## Output

Prints the static issues (rule + severity + Chinese description), the AI DBA
suggestions (title + severity + solution), and an overall health score (0-100).

## Severity guide

- **HIGH** — fix before shipping (full scans, OOM risk, deadlocks, cartesian products).
- **MEDIUM** — should fix (over-fetching, minor inefficiencies).
- **LOW** — nice to have.
