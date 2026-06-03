#!/usr/bin/env python3
"""Audit a SQL query for static + AI anti-patterns and print the findings."""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "_shared"))
from sql_api_client import anti_patterns  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="SQL anti-pattern audit")
    parser.add_argument("sql", help="The SQL statement to audit")
    args = parser.parse_args()

    resp = anti_patterns(args.sql)

    print(f"健康评分: {resp.get('overall_health_score')}/100\n")

    static = resp.get("static_issues", [])
    print(f"[静态规则命中 {len(static)} 项]")
    for s in static:
        print(f"  [{s.get('severity')}] {s.get('rule')}")
        print(f"      {s.get('description')}")

    ai = resp.get("ai_issues", [])
    print(f"\n[AI DBA 调优建议 {len(ai)} 项]")
    for a in ai:
        print(f"  [{a.get('severity')}] {a.get('title')}")
        print(f"      {a.get('solution')}")


if __name__ == "__main__":
    main()
