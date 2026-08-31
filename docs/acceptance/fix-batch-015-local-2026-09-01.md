# FIX-BATCH-015 验收回执

- 时间：2026-09-01 05:48（Asia/Shanghai）
- 基线：本地/GitHub main `c6cd5be`；腾讯 runtime/current `d350ac3`
- 阶段：`main + deployed-code / not real-probed / not persistently receipted / not rendered / not accepted`
- 真实外联：0；未读取二维码载荷、凭证或真实图源

## 已验证候选

1. 每个面板按唯一 tile key 统计 expected、loaded、failed。
2. 仍有 pending 瓦片时保持 loading，不能因首个成功瓦片假报整屏成功。
3. 全部结算后分别产生完整、partial 或全失败；失败瓦片重试成功可恢复。
4. 页面逐屏显示“成功 loaded/expected，失败 failed”；组件卸载后不再接收旧加载事件。

## 当前证据

- `frame-quality.test.ts` 与 `history-workspace.test.tsx`：2 files / 8 tests 全绿。
- `@omb/web` typecheck 全绿。
- `git diff --check` 全绿。
- 执行前根卷约 8.41 GiB，高于 8 GiB 门但余量有限。
- 全仓 3 Node＋260 Vitest、8 workspace typecheck、production build/smoke 全绿。
- 首次公开 Chrome E2E 为 2/4：两个时序用例仍查找旧“已加载”文案，产品已显示严格质量计数。失败保留且不计 local-verified；断言已同步，待重跑。
- 第二次公开 Chrome E2E 为 3/4：双湖用例切换到高邮湖后的另一处旧文案断言遗漏；失败保留，最终旧断言已同步，待第三轮。
- 第三次公开 Chrome E2E 仍为 3/4：双湖用例返回宝应湖后的另一处旧文案先触发。随后全仓搜索一次性定位该文件剩余 5 处旧断言，并统一使用完整/失败质量正则；失败保留，待第四轮。
- 第四次公开 Chrome E2E 4/4 全绿；本批达到 local-verified。三次红灯完整保留，不覆盖或改写为一次通过。
- 全门完成后根卷于 05:56 突降至 `7,562,484 KiB`（约 7.21 GiB），低于 8 GiB 门；只读检查未发现 Playwright/Vite/项目 gateway 残留，swap 使用约 5.37 GiB。后续测试、构建、浏览器、推送和部署暂停，只做本地 checkpoint。
- 06:42 根卷恢复到 `9,398,964 KiB`（约 8.96 GiB）；origin/main `c6cd5be` 与 CI `33441198030` 无漂移。腾讯 current `d350ac3`、service active、双回环、health/401、权威 state/vault 0600 与服务器容量均通过；只读复核不改变部署阶段。
- PR #41 首轮 CI `33447491953` 对 head `b614845` 全绿；这是分支远端验证，不是 main、腾讯部署或真实源验收。
- 证据提交 CI `33447704065` 全绿；PR #41 squash 合并为 main/origin `67a6a0e`，main CI `33447839812` 全绿。
- 精确 main production build/smoke 通过；腾讯 immutable release/current=`67a6a0e`。gateway/Web index SHA-256=`73808e31…4eb8d`/`3dd8d87d…d799`，首次 health 短暂 502 后恢复；health/401/双回环/state-vault hash/0600 均通过，旧 `d350ac3` 保留。
- 服务器浏览器经临时 SSH 隧道显示四个合成面板均为“完整加载（成功 6/6，失败 0）”，无 error/warning；页面与隧道已关闭。此结果只验证部署 UI，不是用户真实图源 rendered。
- 部署证据 PR #42 CI `33448263589` 全绿并合并为 docs-only main `f506a12`；main CI `33448403058` 全绿。运行源码/current 保持 `67a6a0e`，不为证据提交重复发布。
- 最终证据 PR #43 合并为 docs-only main `7f38543`，main CI `33448733929` 全绿；FIX-BATCH-015 三端最终收口。

## 未达到

- ComparisonReceipt 创建与持久化仍未实现；没有真实浏览器画布回执。
- 合成测试、瓦片 HTTP 成功和计数状态均不构成真实源 `rendered` 或用户 `accepted`。

后续状态：原唯一下一动作已完成；FIX-BATCH-016 已在独立分支形成 ComparisonReceipt 创建/持久化的 local-verified 候选，详见 `fix-batch-016-local-2026-09-01.md`。本回执中的“未实现”保留为 FIX-BATCH-015 当时边界，不追写成当时已完成。
