#!/usr/bin/env python3
"""Audit a SQL query for PII/compliance risks and print the privacy report."""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "_shared"))
from sql_api_client import optimize  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="SQL privacy & compliance audit")
    parser.add_argument("sql", help="The SQL statement to audit")
    args = parser.parse_args()

    resp = optimize(args.sql)
    rep = resp.get("privacy_report", {})

    print(f"是否安全 (is_safe) : {rep.get('is_safe')}")
    print(f"风险分             : {rep.get('risk_score')}/100")
    pii = rep.get("PII_columns_exposed", [])
    print(f"暴露 PII 列        : {', '.join(pii) if pii else '无'}")
    issues = rep.get("compliance_issues", [])
    if issues:
        print("合规问题:")
        for i in issues:
            print(f"  · {i}")
    print(f"\n[整改建议]\n{rep.get('recommended_remediation', '')}")


if __name__ == "__main__":
    main()
