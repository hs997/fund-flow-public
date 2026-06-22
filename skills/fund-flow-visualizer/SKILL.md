---
name: fund-flow-visualizer
description: Inspect, validate, and summarize published A-share sector main-fund-flow JSON snapshots from 水哥养基. Use when a user asks to read the latest sector fund-flow data, rank net inflows or outflows, check snapshot freshness or errors, compare sectors, or explain the published data fields. This public skill reads existing snapshots only; it does not contain the private crawler or video renderer.
---

# Fund Flow Visualizer

Use the published JSON snapshot to produce a concise, source-grounded market summary. Keep the metric explicit: cumulative main-fund net amount, in CNY 100 million.

## Workflow

1. Locate the snapshot. Prefer a user-provided file or URL; otherwise look for `data/latest.json` in the repository root.
2. Run `scripts/inspect_snapshot.py` with `--file` or `--url`.
3. Check `ok`, `trade_date`, `latest_time`, `updated_at`, `metric`, `unit`, `source`, and `errors` before interpreting rankings.
4. Report the strongest positive and negative sectors separately. Never describe a negative value as an inflow.
5. Mention stale sectors or collection errors when present.
6. Add the repository disclaimer. Do not turn the snapshot into individualized investment advice.

## Commands

```powershell
python scripts/inspect_snapshot.py --file ..\..\data\latest.json --top 5
```

```powershell
python scripts/inspect_snapshot.py --url <raw-json-url> --top 5
```

Use `--json` when another program needs a compact machine-readable summary.

## Interpretation Rules

- Values above zero are net inflows; values below zero are net outflows.
- Do not equate main-fund flow with total market turnover or index return.
- Do not compare snapshots with different metrics without clearly naming the difference.
- Treat a closed-market snapshot as final only for the trade date shown.
- Read `references/data-contract.md` when validating integrations or field meanings.

