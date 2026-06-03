#!/usr/bin/env python3
"""Run the multi-agent SQL Governance Board on a SQL statement and print the report."""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "_shared"))
from sql_api_client import governance_review  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Multi-agent SQL governance board review")
    parser.add_argument("sql", help="The SQL statement to review")
    parser.add_argument("--sandbox", action="store_true", help="Also run the sandbox benchmark specialist")
    args = parser.parse_args()

    resp = governance_review(args.sql, run_sandbox=args.sandbox)
    report = resp.get("report", {})

    print("=" * 70)
    print(f"裁决 VERDICT : {report.get('overall_verdict')}")
    print(f"综合风险分    : {report.get('overall_risk_score')}/100")
    print("=" * 70)
    print(f"\n[主审官综合裁决]\n{report.get('consensus_summary', '')}\n")

    for v in report.get("specialist_verdicts", []):
        risk = f"  (风险 {v['risk_contribution']})" if v.get("risk_contribution") else ""
        print(f"── 【{v.get('role')}】[{v.get('status')}]{risk}")
        print(f"   {v.get('headline')}")
        for f in v.get("findings", []):
            print(f"     · {f}")
        print()

    actions = report.get("action_items", [])
    if actions:
        print("[整改清单]")
        for i, item in enumerate(actions, 1):
            print(f"  {i}. {item}")

    print(f"\n[推荐采用的优化 SQL]\n{report.get('recommended_sql', '')}")


if __name__ == "__main__":
    main()
