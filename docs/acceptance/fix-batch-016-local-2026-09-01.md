# FIX-BATCH-016 本地验收回执

- 时间：2026-09-01 07:18（Asia/Shanghai）
- 基线：本地/GitHub main/origin `7f38543`，CI `33448733929`；腾讯 runtime/current `67a6a0e`
- 分支：`codex/fix-batch-016-comparison-receipts`
- 阶段：`local-verified / not main / not deployed / not real-rendered / not accepted`
- 真实外联：0；未读取或保存二维码载荷、token、cookie、密钥、凭证明文或私有认证值

## 先验与数据安全

- 修改 schema 前只读检查腾讯权威 `/var/lib/open-map-bridge/temporal-state.json`：`comparisons=0`、`aois=2`。
- 因生产旧回执为空，V1 可以严格失败关闭；没有迁移、删除、覆盖或伪造用户回执。
- 腾讯 service、release、state、vault 均未在本批修改。

## 已验证

1. ComparisonReceipt V1 必须有 4 个互异日期、4 个同序帧、严格 EPSG:3857 ViewState 和终态质量计数。
2. loaded/partial/failed 的 expected、loaded、failed 必须全部结算且数量守恒；missing 不得声称请求过瓦片；loading/waiting 不可持久化。
3. POST 由服务端生成 ID/createdAt，只接受 ready source、精确存在且 confirmed 的 AOI 版本、当前 20 年目录内日期，并核对 missing 真值。
4. repository 写入和重开使用同一 schema，并拒绝不存在的 AOI 版本。
5. Web 在 AOI/日期变化后清空旧质量状态；只有四日期互异、共享视角和四帧终态齐备时才能保存。
6. 隔离 Chrome 旅程完成：新建任意区域 → 四屏全部完整 → POST 201 → 页面显示 1 条 → 刷新并重新选择该区域 → 仍显示 1 条。

## 本地门

- `git diff --check`：通过。
- Node 契约：3/3。
- Vitest：46 files / 271 tests。
- TypeScript：8 workspace 全绿。
- production build：通过；保留既有 Web 大 chunk warning。
- production smoke：鉴权、持久化、SIGTERM 全绿。
- Chrome E2E：4/4，全程使用唯一临时状态文件。
- 完成后根卷 `8,990,284 KiB`（8.57 GiB），高于 8 GiB 门。

## 未达到

- 分支尚未经过 PR CI、合并 main 或腾讯 versioned release。
- ObservationPanel 仍没有保存/读取业务闭环，因此 OMB-AUD-015 只是 partial。
- 其他 receipt 的严格引用、跨进程写入和备份恢复仍开放，因此 OMB-AUD-016 只是 partial。
- 合成瓦片事件回执不证明真实像素已绘入画布，不证明真实奥维源、真实历史日期、污染因果或用户 accepted。

唯一最安全下一动作：由 Codex 更新技术交底指纹并提交 FIX-BATCH-016 PR；GitHub CI 全绿前不合并、不部署。用户行动：无。
