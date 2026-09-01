# OpenMapBridge 跨项目合并准备矩阵

## 文档状态

- 矩阵 ID：`OMB-MERGE-READINESS-001`
- 建立时间：2026-09-01 10:00（Asia/Shanghai）
- 当前状态：OpenMapBridge 侧已填写；目标项目 `unknown`
- 当前授权：只做 GitHub 交接，不做云部署、数据迁移或跨仓代码移动

## 决策原则

1. 先比较能力与所有权，再选择仓库形态。
2. schema、凭证、网络安全和状态机只能有一个 canonical owner。
3. 原始二维码/`.ovmap`、秘密、数据库、tile cache 和真实影像不随 Git 合并。
4. 复用优先级：公开 API/SDK > workspace package > 有边界的源码迁移 > 经批准重写。
5. `main`、CI、deployed、accepted 分开验收。

## 目标项目身份

| 字段 | 当前值 |
|---|---|
| 仓库/本地路径 | `unknown` |
| 权威分支 | `unknown` |
| License | `unknown` |
| 运行时/框架 | `unknown` |
| 当前部署 | `unknown` |
| 数据/秘密所有者 | `unknown` |
| 合并负责人 | `unknown` |

## 能力矩阵

| 能力 | OpenMapBridge 资产 | 推荐 owner | 目标项目等价物 | 最终决策 | 合并门 |
|---|---|---|---|---|---|
| 图源开放 schema | `packages/source-schema` | OpenMapBridge | `unknown` | `pending` | 字段、状态、迁移、回滚一致 |
| QR/OMS 导入 | `packages/qr-import` | OpenMapBridge | `unknown` | `pending` | 正反 fixture、零外联预览、秘密不落盘 |
| `.ovmap` codec | `packages/ovmap-codec` | OpenMapBridge | `unknown` | `pending` | 家族/version 显式、未知 fail closed |
| 凭证 vault | `credential-vault.ts` | 单一 owner，待比较 | `unknown` | `pending` | key 不入 Git；引用和轮换语义唯一 |
| SSRF/DNS rebinding | `source-policy.ts`、`upstream-network.ts` | 请求发起方 | `unknown` | `pending` | DNS 前后、peer 固定、redirect/size/type 门 |
| 最小 probe | `generic-source-probe.ts` | OpenMapBridge | `unknown` | `pending` | ProbeResult 脱敏、同修订、失败不 ready |
| 非时序瓦片 | `routes/generic-tiles.ts` | OpenMapBridge gateway | `unknown` | `pending` | 只按 source UUID/坐标，不接任意 URL/query |
| 时序 catalog/tiles | temporal adapters/routes | 按真实 provider 决定 | `unknown` | `pending` | 不伪造日期；真实目录/日期/瓦片可追溯 |
| AOI/四屏/回执 | `packages/temporal-source`、history UI | 目标业务平台优先 | `unknown` | `pending` | 坐标/视角/帧/来源回执一致 |
| SDK/能力目录 | `packages/developer-sdk` | OpenMapBridge contract | `unknown` | `pending` | 版本化 package、能力协商、权限失败关闭 |
| 任务编排/视频/分析 | 仅部分 backlog | 目标业务平台 | `unknown` | `pending` | 续跑/取消/配额/证据链/结果验收 |

`最终决策` 只能填写：`reuse-as-service`、`reuse-as-package`、`target-wins`、`rewrite-approved` 或 `drop-with-rationale`。

## 合并顺序

1. 只读盘点目标项目和 license/依赖/运行时。
2. 填完能力矩阵，指定 canonical owner。
3. 写集成 ADR：仓库形态、API 边界、数据迁移、秘密边界、回滚。
4. 建独立 integration branch，先接 SDK/contract test。
5. 合成 fixture 全绿后，再为一个用户授权真实源安排单独验收。

## 不可接受的合并方式

- 直接把一个仓库覆盖到另一个仓库；
- 同时保留两套 vault、图源状态或 SSRF 门并双写；
- 把服务器 `data/db/source` 当迁移种子提交 Git；
- 因 HTTP 200、CI 绿或合成四屏而宣称真实奥维兼容；
- 未确认 license 就复制外部仓库代码或 fixture；
- 在目标项目身份仍为 `unknown` 时提前决定 monorepo/submodule/subtree。

## 合并验收

- 同一个 source UUID 从导入、凭证引用、probe、能力目录到消费端不漂移；
- 失败/unknown/missing 不被转换为成功或零；
- 目标平台看不到上游 URL、私密 query/header、vault ref 和原始载荷；
- 请求时仍经过 DNS/IP/peer/响应完整性门；
- 真实日期、四帧、AOI/version、质量和来源回执可追溯；
- 任一项目可在不丢失权威数据的情况下回滚。

## 唯一最安全下一动作

未来合并负责人填写“目标项目身份”和“目标项目等价物”两列，再提交一份不改代码的 integration ADR 供审阅。

用户行动：无。
