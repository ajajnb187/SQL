---
name: sql-tuning
description: Optimize a slow SQL query. Fetches the EXPLAIN plan, then returns a rewritten query, suggested index DDL, a Chinese bottleneck analysis, the optimization strategy, and an estimated speedup. Use when a query is slow, when APM flags a high-latency statement, or when asked to "优化/调优这条 SQL".
---

# SQL Tuning (AI 调优)

Wraps the project's `SQLTuner` (a Principal-DBA-style LLM prompt over the query's
real EXPLAIN plan) to produce an optimized rewrite plus index recommendations.

## When to use

- A specific query is slow and you want a concrete rewrite + indexes.
- You only need performance advice (for a full multi-dimension review including
  security and anti-patterns, use the `sql-governance-review` skill instead).

## How to run

Backend must be running (`SQL_API_BASE`, default `http://localhost:8090`).

```bash
python skills/sql-tuning/scripts/tune.py "SELECT * FROM causal_inference.sales s JOIN causal_inference.product p ON s.item_id = p.item_id"
```

## Output

Prints the original SQL, the optimized SQL, suggested `CREATE INDEX` DDL, the
bottleneck analysis, the optimization strategy, and the estimated speedup
(all explanations in Chinese).

## Verify before applying

Index DDL and rewrites should be benchmarked before shipping — use the
`/enterprise/tuning/benchmark` endpoint (transactional sandbox, auto rollback)
or the `--sandbox` flag of the `sql-governance-review` skill.
