# 水哥养基板块资金流数据

这里发布 A 股固定板块池的资金流快照、公开气泡图网页，以及一个可安装的 Codex Skill。公开层只提供结果数据和读取工具，不包含抓取、视频渲染或 APP 源码。

## 公开网页

关注者可以打开公开网页查看资金流气泡图：

```text
https://hs997.github.io/fund-flow-public/
```

网页会直接读取公开站点同源的 `data/latest.json`，并每 60 秒自动检查一次公开快照是否更新。红色代表主力净流入，绿色代表主力净流出。公开端不依赖 GitHub API，避免关注者访问时触发匿名 API 限流。

## 当前内容

- `data/latest.json`：最新发布快照
- `index.html`：公开资金流气泡图网页
- `static/`：公开网页所需的 CSS、JS 和本地化前端依赖
- `skills/fund-flow-visualizer`：读取、校验并汇总快照的 Codex Skill

当前指标为**累计主力净额**，单位为**亿元**。正数代表净流入，负数代表净流出。数据更新时间以 JSON 内的 `trade_date`、`latest_time` 和 `updated_at` 为准。

## 安装 Skill

克隆仓库后，把 `skills/fund-flow-visualizer` 放入个人 Codex Skills 目录：

```powershell
Copy-Item -Recurse .\skills\fund-flow-visualizer "$env:USERPROFILE\.codex\skills\fund-flow-visualizer"
```

随后可以说：`使用 $fund-flow-visualizer 分析最新板块资金流。`

## 权限分层

| 层级 | 仓库 | 内容 |
| --- | --- | --- |
| 公开 | `fund-flow-public` | 数据快照、字段说明、轻量 Skill |
| 群成员 | `fund-flow-code` | 抓取、网页展示、曲线和气泡视频源码 |
| 会员 | `fund-flow-app` | Windows/移动端成品与更新包 |
| 内部 | `fund-flow-internal` | 部署、密钥配置和发布流程 |

GitHub 公开仓库无法验证抖音关注状态，看到公开链接的人都能访问。私有层由仓库所有者手动添加和移除协作者。

## 说明

GitHub Pages 是公开展示层，不是实时行情后端。当前网页每 60 秒读取公开快照；分钟级持续更新由私有源码仓库里的发布器负责生成 `data/latest.json`，并同步到 `gh-pages` 分支。GitHub Actions 定时任务不适合承诺严格 1 分钟更新，因此生产环境建议使用稳定在线的本机、VPS 或云服务器运行私有发布器。

数据仅作可视化展示与学习交流，不构成任何投资建议。投资有风险，入市需谨慎。
