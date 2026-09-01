# OpenMapBridge 跨项目 Agent 完整交接

## 0. 先读结论

- 权威仓库：<https://github.com/LegalInvest/open-map-bridge>
- 本仓定位：奥维兼容图源的 clean-room 导入、安全代理、能力判定与二次开发桥。
- 本仓不是：奥维客户端完整复刻、历史影像供应商、Google Earth Engine 计算引擎或真实图源已验收产品。
- 更高层产品主目标：用户在地图上框选任意区域，系统自动给出跨约 20 年的四期真实影像，并可比较、播放和导出；宝应湖、高邮湖只是首批实验区。
- 真实遥感探针仓库：<https://github.com/LegalInvest/real-remote-sensing-spike>
- 当前交付策略：GitHub-only；不继续腾讯云发布。后续项目先通过 API/SDK 对接，再决定是否合仓。

接手者必须继续区分：

`discovered -> local-candidate -> local-verified -> main -> deployed -> accepted`

CI 成功、HTTP 200、合成四屏、健康进程和官方奥维中出现时间轴，都不是“真实图源已在开放系统完成出图”的替代证据。

## 1. 用户真正要解决的问题

最终用户旅程不是“做一个双湖演示”，也不是“单独解码一个二维码”：

1. 用户扫描奥维兼容二维码，或导入 `.ovmap`。
2. 系统在联网前解析、脱敏并显示图源事实与风险。
3. 用户确认自己有权使用该图源。
4. 系统通过本地安全边界完成最小 probe，只有真实图片门通过才授予能力。
5. 用户在真实地图上绘制任意矩形或多边形 AOI。
6. 系统取得约 20 年真实日期/影像，默认选四个互异时期。
7. 四屏使用同一 AOI、投影和视角，显示加载、部分失败、缺失及日期精度。
8. 用户可以卷帘、播放、保存比较回执，后续导出 GIF/MP4。
9. 开发者只用 source ID、能力目录和本地 API/SDK 二次开发，不复制私有载荷、上游模板或凭证。

污染、过度养殖、过度开发和渔猎压力属于解释性假设。仅凭影像可以记录可见变化，不能直接形成确定因果结论。

## 2. 会话决策时间线（脱敏重建）

| 顺序 | 用户裁决或纠偏 | 对实现的影响 |
|---|---|---|
| 1 | 先穷尽 GitHub、奥维生态、企业上下游和爱好者社区，尽量不重复造轮子 | 先研究开源候选、许可证和可复用边界 |
| 2 | 希望框选卫星影像区域，自动生成 2000–2025 变化轨迹视频 | 将真实时序遥感和视频列为最终消费能力 |
| 3 | 希望接奥维图源；二维码扫码和 `.ovmap` 都必须导入 | 建立 QR、`.ovmap`、统一 source schema 和安全网关主链 |
| 4 | 长期希望开源版奥维具备大量二次开发能力 | 内核采用开放 schema；奥维仅为兼容适配边界 |
| 5 | 可以先做 Web UI，重点是拉起来 | 采用 Web＋本地 gateway，而不是先做全平台原生客户端 |
| 6 | PDF 中“数字义乌”四张历史影像对比是目标形态 | 四期同视角比较成为代表性业务界面 |
| 7 | 一个奥维历史影像二维码可选择多个年份 | QR 不再被建模成单静态图层；增加时序源能力 |
| 8 | 宝应湖和高邮湖过去 20 年先做实验 | 建立双湖 approximate fixture，但不把截图当精确 GeoJSON |
| 9 | 最终必须是任意图源、任意框选区域自动四期 | 双湖从产品主体降为验收样例 |
| 10 | 项目核心首先是奥维图源导入，且最终要基于图源二次开发 | 导入、安全、capability API/SDK 优先于消费端美化 |
| 11 | 数字化之后要提升可视化和自动化 | 增加任务驾驶舱、真实状态、人工门和续跑方向 |
| 12 | 暂不推云服务器，只进 GitHub，未来与另一个项目讨论合并 | 腾讯状态降为历史证据，当前 source of truth 变为 GitHub |
| 13 | 用户澄清早期“最快真实遥感 Spike”才是一直想要的主目标 | OpenMapBridge 被重新定位为支撑兼容层，真实遥感计算由独立 Spike 验证 |
| 14 | 用户要求收尾、上传 GitHub并清理本机 | 两仓均已建立 GitHub 归档；原项目目录已清理 |
| 15 | 用户要求给后续两个 agent 最全上下文 | 新增本交接；不把可用凭据或私人原件写进公共 Git 历史 |

## 3. 两个仓库的职责边界

```text
用户 QR / .ovmap
        |
        v
OpenMapBridge
  解析 -> 脱敏 -> 用户确认 -> vault/policy -> probe -> capability
        |
        | source ID + local API/SDK + AOI/date/frame receipts
        v
真实遥感/历史影像平台
  AOI -> 数据选择 -> 年度/时相合成 -> 四屏/时间轴 -> GIF/MP4 -> 分析报告
```

默认推荐是服务/API 集成，不要先复制代码：

- OpenMapBridge 继续拥有 `source-schema`、QR/`.ovmap` codec、vault、SSRF/DNS/peer 门、probe 和 capability 判定。
- 目标项目拥有遥感任务、AOI 业务 UI、跨传感器合成、质量评价、视频和分析报告。
- 如果目标项目已有等价安全层，先在 `docs/merge-readiness.md` 指定 canonical owner，避免双 vault、双 source ID 或双状态机。

## 4. 当前代码和证据真值

### 已进入 GitHub main 的可复用能力

- QR 图片/摄像头入口和已观察 `ovobj`/OMS 方言解析。
- `.ovmap` 的 `OviO + record37-zlib` 已验证家族解析。
- 统一开放 `MapSourceDefinition`、导入预览、确认和脱敏回执。
- 本地鉴权、Host/Origin/CSRF/权限/限流边界。
- 加密 vault、请求计划、请求时 DNS/IP/peer 固定、最小 probe 和非时序 `map-tiles` 能力。
- 时序 schema、AOI、四屏/卷帘/播放、帧质量和严格 ComparisonReceipt。
- 开发者 V1 API、TypeScript SDK 与能力门。

### 仍没有完成

- 用户授权的真实奥维历史源没有在开放系统得到第一条真实 ProbeResult。
- 没有从真实奥维源取得并验证四个日期的真实瓦片。
- 没有证明浏览器真实画布已经显示这些瓦片。
- 没有用户从 QR/`.ovmap` 一路独立完成 `rendered+saved+accepted`。
- `.ovmap` 只覆盖一个已验证家族，不是全版本兼容。
- Observation 保存、复杂 AOI 拓扑、生产禁 synthetic、SDK 正式发布包、跨进程事务/备份、分页和背压仍开放。

详细阶段和问题以 `research.md`、`BLOCKED.md` 和 `docs/问题账本.md` 为准。

## 5. 会话附件与真实输入索引

原附件均来自聊天/临时目录，2026-09-01 收尾复核时原路径已不存在，故不能从本机恢复或上传。以下仅保存不会暴露载荷的用途说明：

| 原始文件名 | 会话中的用途 | 已确认事实 | 当前状态 |
|---|---|---|---|
| `新图软件智慧城市解决方案.pdf` | 参考“数字义乌”历史影像对比平台 | 用户关注其中一次展示四张历史影像的界面 | 临时原件已不存在；未提交 |
| `codex-clipboard-c48868d9-b284-43ca-8789-d93a6b118c27.png` | PDF 页面截图 | 四画面历史影像并列对比、区域轮廓与年份列表是产品参考 | 临时原件已不存在；未提交 |
| `codex-clipboard-0246c5cf-3069-4950-8a16-a80db875ad97.jpg` | 用户授权试验的奥维历史图源二维码 | 图面文字为“奥维高清历史影像91(ID:200)”；官方奥维 10.6.0 导入后识别为 GEE 协议历史影像并出现时间轴 | 二维码原图和载荷均未提交；临时原件已不存在 |
| `codex-clipboard-55ccffb7-ca36-443e-9af0-2a4740177eaa.png` | 宝应湖、高邮湖红框实验区 | 两块红框只能作为 approximate 业务范围，不具备地理配准证据 | 临时原件已不存在；未提交 |

如果未来重新提供输入，应放在 Git 忽略的本地受控目录，并在仓库只记录：输入类型、不可逆哈希、大小、解析器版本、脱敏字段、授权声明和验收结果。不要提交原图、原载荷、Cookie、token 或私有 `.ovmap`。

## 6. OAuth、账号和秘密交接规则

“最全上下文”不等于把可用凭据永久写入 Git 历史。后续 agent 需要知道的是：

- Earth Engine 曾到达 Google 登录页，但没有完成登录、注册、Cloud Project 选择或导出。
- 本仓没有可用 Google/Ovi OAuth 凭据、账号密码、Cookie、API key 或 recovery material。
- GitHub 仓库不得接收这些值，即使后来删除文件，旧 commit 和 fork 仍可能保留。
- 若恢复真实源实验，由账户所有者在本机 UI 完成登录；agent 只读取“已授权/未授权”状态。
- 运行时秘密应进入仓库外 secret store 或 OpenMapBridge vault；文档只记录 secret reference 和轮换状态。

## 7. 后续 Agent 的阅读与执行顺序

1. 本文件。
2. `HANDOFF.md`。
3. `goal.md`，确认产品/验收真值。
4. `research.md`，确认现实证据与阶段。
5. `PROGRESS.md`、`BLOCKED.md`、`docs/问题账本.md`。
6. `docs/merge-readiness.md`。
7. 真实遥感仓库的 `AGENT_HANDOFF.md` 和 `SESSION_HANDOFF.md`。

开始任何合并前先运行：

```bash
git fetch origin
git status --short --branch
git rev-parse HEAD origin/main
gh run list --branch main --limit 8
```

本机可用空间不足 8 GiB 时，不安装依赖、不构建、不启动浏览器、不下载影像。

## 8. 下一位 Agent 不得作出的错误推断

- “二维码被解析”不等于“源可用”。
- “官方奥维出现时间轴”不等于“OpenMapBridge 已取得真实日期/瓦片”。
- “合成四屏通过”不等于“双湖真实对比完成”。
- “HTTP 200 图片”不等于“投影正确、画布已渲染”。
- “GitHub CI 绿”不等于“云端部署”或“用户验收”。
- “Landsat 脚本存在”不等于“26 帧/GIF/MP4 已生成”。
- “用户允许上传”不等于应把长期凭据和私人原件提交到公共 Git 历史。

## 9. 唯一最安全下一动作

未来合并负责人同时克隆两个仓库，先填写 OpenMapBridge 的 `docs/merge-readiness.md`，明确目标项目和 canonical owner；随后只用无秘密 fixture 做 API/SDK 集成。真实授权源和 Earth Engine 登录必须作为独立人工门，成功后再执行真实 AOI 四期验收。
