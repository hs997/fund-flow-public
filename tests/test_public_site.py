from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PublicSiteTests(unittest.TestCase):
    def test_required_public_files_exist(self) -> None:
        for path in [
            "index.html",
            "static/app.js",
            "static/app.20260629-403fix.js",
            "static/app.20260702-rawdata.js",
            "static/app.20260706-pagesdata.js",
            "static/styles.css",
            "static/vendor/d3.min.js",
            "static/vendor/lucide.min.js",
            "data/latest.json",
        ]:
            self.assertTrue((ROOT / path).exists(), path)

    def test_index_references_static_assets(self) -> None:
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("static/styles.css", html)
        self.assertIn("static/vendor/d3.min.js", html)
        self.assertIn("static/vendor/lucide.min.js", html)
        self.assertIn("static/app.20260706-pagesdata.js", html)
        self.assertIn("公开资金流气泡图", html)

    def test_latest_json_contract(self) -> None:
        payload = json.loads((ROOT / "data" / "latest.json").read_text(encoding="utf-8"))
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["brand"], "水哥养基")
        self.assertEqual(payload["metric"], "累计主力净额")
        self.assertEqual(payload["unit"], "亿元")
        self.assertEqual(payload["refresh_seconds"], 60)
        self.assertGreaterEqual(len(payload["sectors"]), 20)
        first = payload["sectors"][0]
        self.assertNotIn("board" + "_code", first)
        for key in ["label", "value", "history", "stale"]:
            self.assertIn(key, first)

    def test_frontend_polls_public_json_every_minute(self) -> None:
        script = (ROOT / "static" / "app.20260706-pagesdata.js").read_text(encoding="utf-8")
        self.assertIn("raw.githubusercontent.com/hs997/fund-flow-public/main/data/latest.json", script)
        self.assertIn("data/latest.json", script)
        self.assertNotIn("api.github.com", script)
        self.assertIn("application/json", script)
        self.assertIn("Math.floor(Date.now() / 60000)", script)
        self.assertIn("const DEFAULT_POLL_SECONDS = 60", script)
        self.assertIn("cache: \"no-store\"", script)
        self.assertIn("setInterval(() => fetchFlow({ silent: true })", script)


if __name__ == "__main__":
    unittest.main()
