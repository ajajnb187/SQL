#!/usr/bin/env python3
"""Shared thin HTTP client for the enterprise SQL governance API.

Used by the bundled scripts of the SQL governance Agent Skills. Has no third-party
dependencies (urllib only) so it runs anywhere Python 3 is available.

Env:
    SQL_API_BASE   Base URL of the running backend (default http://localhost:8090)
"""

from __future__ import annotations

import json
import os
import urllib.request
import urllib.error

API_BASE = os.environ.get("SQL_API_BASE", "http://localhost:8090").rstrip("/")
_PREFIX = "/api/text2sql_lg_code"


def _post(path: str, payload: dict, timeout: float = 120.0) -> dict:
    url = f"{API_BASE}{_PREFIX}{path}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        raise SystemExit(f"API error {e.code}: {body}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Cannot reach backend at {API_BASE} ({e}). Is it running?")


def governance_review(sql: str, run_sandbox: bool = False) -> dict:
    return _post("/enterprise/agents/review", {"sql_query": sql, "run_sandbox": run_sandbox})


def optimize(sql: str) -> dict:
    return _post("/enterprise/tuning/optimize", {"sql_query": sql})


def anti_patterns(sql: str) -> dict:
    return _post("/enterprise/tuning/anti-patterns", {"sql_query": sql})
