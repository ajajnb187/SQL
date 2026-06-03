#!/usr/bin/env python3
"""Optimize a single SQL query and print the tuning recommendation."""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "_shared"))
from sql_api_client import optimize  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="AI SQL tuning")
    parser.add_argument("sql", help="The SQL statement to optimize")
    args = parser.parse_args()

    resp = optimize(args.sql)
    rec = resp.get("tuning_recommendation", {})

    print(f"[原始 SQL]\n{rec.get('original_sql', args.sql)}\n")
    print(f"[优化后 SQL]\n{rec.get('optimized_sql', '')}\n")
    idx = rec.get("suggested_indexes", [])
    if idx:
        print("[建议索引]")
        for d in idx:
            print(f"  {d}")
        print()
    print(f"[瓶颈分析]\n{rec.get('bottleneck_analysis', '')}\n")
    print(f"[优化策略]\n{rec.get('optimization_strategy', '')}\n")
    print(f"[预计提升] {rec.get('estimated_speedup', '')}")


if __name__ == "__main__":
    main()
