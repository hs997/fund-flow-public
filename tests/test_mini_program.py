from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MINI = ROOT / "mini-programs" / "realtime-bubble"


class MiniProgramTests(unittest.TestCase):
    def test_required_files_exist(self) -> None:
        for path in [
            "README.md",
            "app.js",
            "app.json",
            "app.wxss",
            "app.ttss",
            "project.config.json",
            "project.douyin.config.json",
            "sitemap.json",
            "utils/config.js",
            "pages/index/index.js",
            "pages/index/index.wxml",
            "pages/index/index.wxss",
            "pages/index/index.ttml",
            "pages/index/index.ttss",
        ]:
            self.assertTrue((MINI / path).exists(), path)

    def test_app_config_points_to_index(self) -> None:
        config = json.loads((MINI / "app.json").read_text(encoding="utf-8"))
        self.assertEqual(config["pages"], ["pages/index/index"])
        self.assertEqual(config["window"]["navigationBarTitleText"], "水哥养基")

    def test_realtime_data_uses_pages_first_without_github_api(self) -> None:
        config = (MINI / "utils" / "config.js").read_text(encoding="utf-8")
        script = (MINI / "pages" / "index" / "index.js").read_text(encoding="utf-8")
        self.assertIn("DATA_URLS", config)
        self.assertIn("hs997.github.io/fund-flow-public/data/latest.json", config)
        self.assertIn("raw.githubusercontent.com/hs997/fund-flow-public/main/data/latest.json", config)
        self.assertNotIn("api.github.com", config)
        self.assertIn("application/vnd.github.raw+json", script)
        self.assertIn("mini.request", script)
        self.assertIn("Math.floor(Date.now() / 60000)", script)
        self.assertIn('mini.createCanvasContext("bubbleCanvas", this)', script)
        self.assertIn("setTimeout(() => this.loadFlow({ silent: true })", script)

    def test_wechat_and_douyin_markup_have_canvas_and_controls(self) -> None:
        wxml = (MINI / "pages" / "index" / "index.wxml").read_text(encoding="utf-8")
        ttml = (MINI / "pages" / "index" / "index.ttml").read_text(encoding="utf-8")
        self.assertIn('canvas-id="bubbleCanvas"', wxml)
        self.assertIn('canvas-id="bubbleCanvas"', ttml)
        self.assertIn('wx:for="{{summaryCards}}"', wxml)
        self.assertIn('tt:for="{{summaryCards}}"', ttml)
        self.assertIn('data-filter="inflow"', wxml)
        self.assertIn('data-filter="outflow"', ttml)


if __name__ == "__main__":
    unittest.main()
