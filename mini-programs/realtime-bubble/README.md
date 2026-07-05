# 水哥养基实时气泡小程序

这是公开资金流气泡图的小程序版 MVP。代码使用原生小程序语法，页面逻辑共用一份 JS，并同时提供：

- 微信小程序：`index.wxml` + `index.wxss`
- 抖音小程序：`index.ttml` + `index.ttss`

## 本地预览

微信开发者工具：

1. 导入本目录 `mini-programs/realtime-bubble`
2. 填入你自己的微信小程序 AppID
3. 开发阶段可临时开启“不校验合法域名”
4. 预览时确认首页能看到 26 个气泡

抖音开发者工具：

1. 导入本目录 `mini-programs/realtime-bubble`
2. 填入你自己的抖音小程序 AppID
3. 开发阶段可临时关闭域名校验
4. 预览时确认首页能看到 26 个气泡

## 数据地址

默认读取：

```text
https://raw.githubusercontent.com/hs997/fund-flow-public/main/data/latest.json
```

配置在 `utils/config.js`。开发预览可以先用这个地址，失败时会依次回退到 GitHub Contents API 和 GitHub Pages 数据；正式上架建议把第一个地址换成你自己的 HTTPS API 域名，例如：

```text
https://api.your-domain.com/fund-flow/latest.json
```

微信和抖音正式版都需要在平台后台配置 request 合法域名/域名白名单。财经类公开展示还建议使用已备案域名和稳定云服务，GitHub raw 在国内网络下可能偶发超时，GitHub API 有匿名限流，GitHub Pages 又可能有静态缓存延迟。

## 日常更新

后台发布器每 60 秒推送一次公开 JSON。小程序端也每 60 秒请求一次最新快照；周末或收盘后会显示最近一个交易日的 15:00 数据。
