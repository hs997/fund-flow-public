# Snapshot Data Contract

The public snapshot is UTF-8 JSON.

## Top-level fields

- `ok`: whether the snapshot was built successfully.
- `trade_date`: trading date in `YYYY-MM-DD` format.
- `latest_time`: latest market timestamp represented by the snapshot.
- `updated_at`: publication timestamp with timezone.
- `metric`: the financial measure. Current value is cumulative main-fund net amount.
- `unit`: current value is `亿元`.
- `source`: upstream data-source label.
- `errors`: collection failures; an empty array means none were reported.
- `sectors`: ordered sector records.

## Sector fields

- `board_code`: source board identifier.
- `label`: display name used by 水哥养基.
- `value`: cumulative main-fund net amount. Positive is inflow; negative is outflow.
- `history`: minute points with `time` and `value`.
- `stale`: whether this sector is behind the latest represented timestamp.

The schema may gain optional fields. Consumers should ignore unknown fields and must not infer missing values as zero.

