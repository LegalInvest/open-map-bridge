# FIX-BATCH-015 本地候选回执

- 时间：2026-09-01 05:48（Asia/Shanghai）
- 基线：本地/GitHub main `c6cd5be`；腾讯 runtime/current `d350ac3`
- 阶段：`local-verified / not main / not deployed / not rendered / not accepted`
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

## 未达到

- 尚未进入 GitHub PR/main，也未更新腾讯运行制品。
- ComparisonReceipt 创建与持久化仍未实现；没有真实浏览器画布回执。
- 合成测试、瓦片 HTTP 成功和计数状态均不构成真实源 `rendered` 或用户 `accepted`。

唯一最安全下一动作：回写首轮 CI 证据并等待证据提交复验；再次全绿后才合并 main。
