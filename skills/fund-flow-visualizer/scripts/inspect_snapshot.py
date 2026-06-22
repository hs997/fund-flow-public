from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen


def load_snapshot(path: str | None, url: str | None) -> dict:
    if url:
        request = Request(url, headers={"User-Agent": "fund-flow-visualizer/1.0"})
        with urlopen(request, timeout=20) as response:
            return json.load(response)

    snapshot_path = Path(path or "data/latest.json")
    with snapshot_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_summary(payload: dict, top: int) -> dict:
    sectors = payload.get("sectors") or []
    normalized = [
        {
            "label": item.get("label") or item.get("board_name") or item.get("board_code"),
            "value": float(item.get("value", 0)),
            "stale": bool(item.get("stale", False)),
        }
        for item in sectors
    ]
    inflows = sorted((item for item in normalized if item["value"] > 0), key=lambda item: item["value"], reverse=True)
    outflows = sorted((item for item in normalized if item["value"] < 0), key=lambda item: item["value"])
    return {
        "ok": bool(payload.get("ok", False)),
        "brand": payload.get("brand"),
        "trade_date": payload.get("trade_date"),
        "latest_time": payload.get("latest_time"),
        "updated_at": payload.get("updated_at"),
        "market": payload.get("market"),
        "metric": payload.get("metric"),
        "unit": payload.get("unit"),
        "source": payload.get("source"),
        "sector_count": len(normalized),
        "top_inflows": inflows[:top],
        "top_outflows": outflows[:top],
        "stale_sectors": [item["label"] for item in normalized if item["stale"]],
        "errors": payload.get("errors") or [],
        "disclaimer": payload.get("disclaimer"),
    }


def format_rows(rows: list[dict], unit: str) -> str:
    if not rows:
        return "  无"
    return "\n".join(f"  {index}. {row['label']}: {row['value']:+.2f}{unit}" for index, row in enumerate(rows, 1))


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect a published sector fund-flow snapshot.")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--file", help="Path to a snapshot JSON file")
    source.add_argument("--url", help="URL of a snapshot JSON file")
    parser.add_argument("--top", type=int, default=5, help="Number of inflows and outflows to show")
    parser.add_argument("--json", action="store_true", help="Print the summary as JSON")
    args = parser.parse_args()

    try:
        summary = build_summary(load_snapshot(args.file, args.url), max(1, args.top))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"读取快照失败: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(summary, ensure_ascii=False, separators=(",", ":")))
        return 0

    unit = summary.get("unit") or "亿元"
    trade_date = summary.get("trade_date") or "未知"
    latest_time = summary.get("latest_time") or "未知"
    timestamp = latest_time if str(latest_time).startswith(str(trade_date)) else f"{trade_date} {latest_time}"
    print(f"数据日期: {timestamp}")
    print(f"指标: {summary.get('metric')} | 单位: {unit} | 板块数: {summary['sector_count']}")
    print("净流入靠前:")
    print(format_rows(summary["top_inflows"], unit))
    print("净流出靠前:")
    print(format_rows(summary["top_outflows"], unit))
    if summary["stale_sectors"]:
        print("数据可能滞后: " + "、".join(summary["stale_sectors"]))
    if summary["errors"]:
        print("采集错误: " + json.dumps(summary["errors"], ensure_ascii=False))
    print(summary.get("disclaimer") or "仅作数据展示，不构成投资建议。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
