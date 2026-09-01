# OpenMapBridge 零上下文交接

## 1. 文档控制

- 交接 ID：`OMB-HANDOFF-20260901-GITHUB`
- 建立时间：2026-09-01 10:00（Asia/Shanghai）
- 项目：OpenMapBridge，开源奥维兼容图源导入与二次开发桥
- 权威仓库：<https://github.com/LegalInvest/open-map-bridge>
- 权威分支：`main`
- 交接前本地基线：`da34098649c003394718c031f4f1e65797b17a2b`
- 交接前 origin 基线：`31a1047a3fda65ab20d4d98c5d755578a9a49120`
- 最近运行代码提交：`3cf763a8ae0807f7e6b369f636c57d9380ef838f`
- 当前交付策略：GitHub-only；腾讯部署暂停，不属于本轮完成条件

本文件不自称“最终提交哈希”。接手者必须先运行 `git fetch origin && git rev-parse origin/main`，以 GitHub 实时 `main` 为准。

## 2. 一句话定位

OpenMapBridge 不是奥维客户端复刻品，也不是历史影像数据供应商；它是 clean-room 兼容层，把用户合法持有的奥维兼容二维码、开放 OMS 和已验证 `.ovmap` 家族转换为可审计的开放图源定义，并通过本地安全网关、能力目录和 TypeScript SDK 供历史影像平台或其他项目二次开发。

## 3. 用户最新决策

`DEC-20260901-001`：暂不把 FIX-BATCH-016 推送到云服务器；当前只要求本地成果、文档和证据全部进入 GitHub。未来由另一个项目与 OpenMapBridge 做能力对照后再决定合并方式。

因此：

- 腾讯历史 release 只作既有部署证据，不再追新；
- 当前“交付完成”指 GitHub `main` 包含代码、控制文档和交接包，且 GitHub CI 完成；
- `deployed` 和 `accepted` 仍按事实保留，不能因 GitHub 完成而自动晋级；
- 合并目标项目尚未指定，任何复制、subtree、monorepo 或服务化决策现在都是 `unknown`。

## 4. 当前可复用资产

| 能力层 | 权威资产 | 已证明阶段 | 明确边界 |
|---|---|---|---|
| 开放图源模型 | `packages/source-schema` | `main` | 不回显上游秘密；未知字段/协议失败关闭 |
| 二维码导入 | `packages/qr-import`、`apps/web/src/import` | `main` | 支持已观察 `ovobj`/OMS；不是所有奥维二维码格式 |
| `.ovmap` 导入 | `packages/ovmap-codec` | `main` | 仅对证据支持的 `OviO + record37-zlib` 家族承诺兼容 |
| 凭证与请求安全 | `apps/gateway/src/security` | `main`；部分历史代码曾 `deployed-code` | vault 只存加密 envelope；主状态只存同 UUID 引用；真实源仍未验收 |
| 最小 probe 与普通瓦片 | `apps/gateway/src/probe`、`routes/probe.ts`、`routes/generic-tiles.ts` | `main` | 只有同请求计划/凭据修订的成功 probe 才授予 `map-tiles`；不伪造时序能力 |
| 时序与四屏 | `packages/temporal-source`、`apps/web/src/history` | `main` | 合成源旅程已自动验证；真实奥维日期目录/瓦片/画布仍未证明 |
| 比较回执 | `comparison-receipt.ts`、`routes/comparisons.ts` | `main` | 严格四日期/四终态帧/引用完整性；Observation 保存仍未完成 |
| 二次开发接口 | `packages/developer-sdk`、`docs/developer-sdk.md` | `main` | V1 只暴露脱敏能力，不暴露 URL 模板、凭证引用或原始导入字节 |

## 5. 证据阶段

| 对象 | 当前事实 |
|---|---|
| GitHub 运行代码 | `3cf763a` 已在 `main`；CI `33450486867` 成功 |
| GitHub 文档基线 | 交接前 origin `31a1047`；CI `33452723127` 成功 |
| 本地交接候选 | `da34098` 之后新增 GitHub-only 交接更新；必须以最终 push/CI 回执为准 |
| 腾讯 | 最后可信 runtime/current=`67a6a0e`；用户已明确暂停续发，本轮不实时复核、不修改 |
| 真实奥维源 | `not real-probed / not rendered / not accepted` |
| 双湖结论 | 只有 approximate AOI 与合成回归；没有真实污染、开发或渔猎因果结论 |

测试绿、GitHub CI 绿、HTTP 200、合成四屏、服务健康都不能替代真实源 `accepted`。

## 6. 另一个项目如何接入

推荐默认架构：OpenMapBridge 继续拥有“导入、兼容、安全、凭证和能力判定”，目标历史影像平台拥有“任务编排、业务 UI、分析、报告和用户权限”，两者先通过 V1 SDK/API 集成。

合并前必须完成 [`docs/merge-readiness.md`](docs/merge-readiness.md)：

1. 填写目标项目仓库、branch、license、运行时和现有图源模型；
2. 对每项能力决定 `reuse-as-package`、`reuse-as-service`、`target-wins` 或 `rewrite-approved`；
3. 先冻结 schema/API/秘密所有权，再移动代码；
4. 在独立集成分支验证，不直接覆盖任一项目 `main`；
5. 只有真实授权源通过端到端门后，才讨论合并后的部署和用户验收。

禁止直接复制的内容：`.env`、token、cookie、二维码载荷/原图、私有 `.ovmap`、`data/`、数据库、vault key、日志、session、tile cache、生成影像、`node_modules/`、`dist/` 和服务器状态文件。

## 7. 建议的模块所有权

```text
OpenMapBridge
  source-schema ─┐
  qr-import      ├─> local gateway / V1 SDK ─> 目标历史影像平台
  ovmap-codec    │                              ├─ 任务编排
  vault/policy   │                              ├─ 四期/视频业务
  probe/runtime ─┘                              └─ 分析与报告
```

如果目标项目已经拥有等价的凭证库、SSRF 门或图源 schema，不能双写。先在合并矩阵中指定一个 canonical owner，并为旧数据制定显式迁移/回滚方案。

## 8. 接手检查命令

这些命令不读取秘密：

```bash
git fetch origin
git status --short --branch
git rev-parse HEAD origin/main
git log -8 --oneline --decorate
gh run list --branch main --limit 8
df -k /
```

只有可用空间至少 8 GiB 时才运行重门：

```bash
npm run env:check
npm test
npm run typecheck
npm run build
npm run test:production
npm run test:e2e
```

授权二维码门只能使用用户控制的本地路径，禁止将输入或 trace/video/screenshot 提交到 Git。

## 9. 风险、回滚与开放问题

- 真实奥维第三方接口尚未在操作时启用和验证回环监听；启用仍需单独确认。
- 用户二维码中的奥维私有不透明字段没有被通用 vault 解释；不得逆向绕过认证或手工重建秘密请求。
- `.ovmap` 还有未知家族；未知版本保持 `unsupported`。
- AOI 复杂拓扑、Observation 保存、单写者/备份迁移、SDK 可发布包、生产禁用 synthetic、分页/背压等仍在问题账本开放。
- Git 回滚点：运行代码可回到 `3cf763a` 的父提交；文档变化可用普通 revert，不允许 reset/强推覆盖共享 main。
- 腾讯回滚信息只保留在 `docs/deployment.md` 和历史验收回执；当前不授权任何服务器动作。

## 10. 权威阅读顺序

1. `HANDOFF.md`
2. `goal.md`
3. `research.md`
4. `PROGRESS.md`
5. `BLOCKED.md`
6. `docs/问题账本.md`
7. `docs/merge-readiness.md`
8. `docs/acceptance/github-handoff-2026-09-01.md`

冲突口径：产品/验收冲突以 `goal.md` 为准；代码/证据冲突以实时 GitHub `main`、CI 和源码为准；部署文档只说明历史状态，不授权新部署。

## 11. 唯一最安全下一动作

未来合并负责人先只读盘点目标项目，并填写 `docs/merge-readiness.md` 的目标项目列和 canonical owner 决策；在该矩阵完成前不移动代码、不迁移数据、不改两个项目的 `main`。

用户行动：无。
