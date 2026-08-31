# FIX-BATCH-014D 验收回执

- 时间：2026-09-01 04:52（Asia/Shanghai）
- 阶段：`main + deployed-code / not real-probed / not rendered / not accepted`
- 工作树基线：`a98d096ff23c57145bec57f0d5f85fa23a74be22`
- 真实外联：0；仅使用进程内本机回环合成上游

## 本批事实

1. 通用 XYZ/TMS/已支持模板源不再被伪装成时序源；新增独立 `map-tiles` 能力与 `/api/tiles/:sourceId/:z/:x/:y`、V1 developer map tile 端点。
2. 只有同一 source UUID 的成功 ProbeResult 才能持久化运行绑定；绑定只保存请求计划指纹、ProbeResult 指纹和时间，不保存 URL、host、凭证或响应正文。
3. 每个瓦片请求重新从同一 source/vault 构造请求，并重新执行静态策略、DNS 全结果/IP 门、单地址固定、peer 复核、5 MiB、MIME 和完整 PNG/JPEG 解码门。
4. 凭证修订变化后，请求计划指纹变化，旧绑定立即失效并撤销 `map-tiles`；必须以新修订重新 probe 才可恢复。
5. 失败 ProbeResult、仅 confirmed 的源、OviBridge 源、非法坐标或带任意 query 的请求均不能进入通用瓦片运行时。
6. `probed` 与 `map-tiles ready` 不等于 `rendered`：本批没有浏览器真实地图画布回执，也没有日期目录或真实历史影像。

## 本地门

- 定向：6 files / 23 tests 与后续 5 files / 20 tests 全绿。
- 全仓：3 Node tests＋257 Vitest 全绿。
- 类型：8 workspace typecheck 全绿。
- 制品：production build 与 production smoke 全绿；保留既有 Web 大 chunk warning。
- 浏览器：4 条公开 Chrome E2E 全绿。
- 容量：执行前后根卷约 9.8 GiB 可用，高于 8 GiB 硬门。
- GitHub：PR #38 功能提交 `72a054b` 的 CI `33439198444` 完整全绿。
- GitHub：证据提交 CI `33439507170`、squash main `d350ac3` 与 main CI `33439685686` 全绿。
- GitHub：部署证据 PR #39 CI `33440530796`、docs-only main `c4f0dcf` 与 main CI `33440688435` 全绿。
- 腾讯：current=`d350ac3`；gateway/Web hash=`73808e31…4eb8d`/`42368f3e…04ad`，health/401/双回环/systemd/state/vault/0600 门通过；首次重启 health 短暂 502 后恢复。

## 阶段边界

- `discovered`：真实奥维/通用源仍未产生受控真实 ProbeResult。
- `local-candidate`：014D 代码已形成。
- `local-verified`：上述本地门已通过。
- `main`：`d350ac3`，CI `33439685686` 全绿。
- `deployed`：腾讯 current `d350ac3`，仅代码部署；未建立真实源绑定。
- `accepted`：未达到；fixture、HTTP 200、图片解码、测试或服务器健康均不替代真实用户出图签收。

唯一最安全下一动作：由 Codex 把部署证据提交 docs-only PR 并等待 PR/main CI；完成后三端状态收口，真实源仍留待单独授权验收。
