# FIX-BATCH-016 本地与 main 验收回执

- 创建时间：2026-09-01 07:18；main 状态更新：2026-09-01 07:49（Asia/Shanghai）
- 基线：本地/main/origin `3cf763a`；PR 证据 CI `33450368931`、main CI `33450486867`；腾讯 runtime/current 最后可信 `67a6a0e`
- 来源分支：`codex/fix-batch-016-comparison-receipts`，已由 PR #44 squash 合并
- 阶段：`main / not deployed / not real-rendered / not accepted`
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
- PR #44 首轮 CI `33450167879`、证据 CI `33450368931` 与 squash main `3cf763a` 的 main CI `33450486867` 完整全绿；这证明代码进入 main，不证明 deployed。
- 07:49 对精确 main 重新构建成功；gateway/Web SHA-256=`fcc835ec…d0762`/`9f2aa734…ee90` 并与 build manifest 一致。

## 未达到

- 腾讯 versioned release 尚未更新；本轮 SSH 被执行沙箱拒绝，未发生服务器修改。
- 本轮本地 production smoke 因执行沙箱禁止绑定 `127.0.0.1` 返回 `EPERM`；同一 main CI smoke 与合并前本地 smoke 已通过，因此只记录为本轮环境限制，不伪装成再次本地验证。
- ObservationPanel 仍没有保存/读取业务闭环，因此 OMB-AUD-015 只是 partial。
- 其他 receipt 的严格引用、跨进程写入和备份恢复仍开放，因此 OMB-AUD-016 只是 partial。
- 合成瓦片事件回执不证明真实像素已绘入画布，不证明真实奥维源、真实历史日期、污染因果或用户 accepted。

唯一最安全下一动作：由 Codex 在网络执行能力恢复后部署精确 main `3cf763a`，并验证 immutable artifact/current、service、health/401、双回环、state/vault 不变与 ComparisonReceipt 写入/刷新回访。用户行动：无。
