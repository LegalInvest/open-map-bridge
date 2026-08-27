# PROGRESS

- 2026-08-27：V0 导入规格和原实施计划已批准并提交到本地 main；当前仍无产品代码或远端仓库。
- 2026-08-27：用户提供真实历史二维码；官方奥维 10.6.0 已导入为“GEE 协议历史影像”，legacy ID 200，主界面出现时间轴。
- 2026-08-27：尚未枚举出真实年份或取得真实瓦片；官方客户端仍显示下载中，不能写为图源已渲染。
- 2026-08-27：用户批准官方奥维本机桥接＋OpenLayers 开放对比核心。
- 2026-08-27：首批验收固定宝应湖、高邮湖 2006–2025；截图红框是 approximate，需在地图确认 GeoJSON。
- 2026-08-27：新增历史影像设计 `docs/superpowers/specs/2026-08-27-temporal-lakes-v0-design.md`，旧导入安全契约保留。
- 当前阶段：temporal spec-approved / implementation-prep；`local-verified/main/deployed/accepted` 均为 0。
- 当前最大风险：官方 Web 服务能否仅监听回环、特殊 GEE 源能否按日期出图、真实拍摄日期可能不可得。
- 当前下一步：增加一键本地启动和浏览器 E2E，再执行官方奥维本机 Web 服务的回环安全门。
- Task 0–5：四屏 Web、共享 ViewState、AOI 拖点/确认、卷帘、2006–2025 时间轴、缺年跳过和分级观察记录已构建；31 tests/typecheck/build 通过；尚未浏览器 E2E。
