# OpenMapBridge V0 导入闭环设计

## 状态

- 类型：架构级绿地项目设计
- 状态：Approved；用户于 2026-08-27 明确回复“书面规格批准”
- 日期：2026-08-27
- 产品真值：项目根目录 `goal.md`
- 现实与证据：项目根目录 `research.md`

## 1. 决策摘要

选择“响应式 Web UI＋本地网关”，而不是纯浏览器或原生优先。

- 纯浏览器虽然最快展示，但无法可靠解决第三方 CORS、秘密保护、`.ovmap` 私有二进制、SSRF 策略和后续大型离线数据。
- 原生优先能更好访问文件和摄像头，却会让首个可运行闭环承担桌面/移动打包成本。
- Web UI＋本地网关保留浏览器的即时体验，并把秘密、网络、安全、解析和持久化放在本机服务；以后可用 Tauri 或移动壳复用同一 schema 和 API。

V0 产品门不是“看起来像奥维”，而是二维码和 `.ovmap` 两个真实入口都到达透明预览、用户确认、最小探测、真实渲染和重启恢复。

## 2. 系统上下文

```text
用户浏览器
  ├─ 摄像头 / QR 图片
  ├─ .ovmap 文件
  ├─ 安全预览和确认
  └─ OpenLayers 地图
          │ localhost API / tile proxy
          ▼
本地网关
  ├─ import inspector
  ├─ QR adapters
  ├─ ovmap codecs
  ├─ protocol normalization
  ├─ security policy + credential vault
  ├─ source registry + receipts
  └─ bounded tile proxy/cache
          │ 用户确认后的 HTTPS/HTTP 请求
          ▼
用户有权访问的外部或明确授权内网图源
```

信任边界：浏览器输入、文件字节、二维码载荷和所有上游响应均不可信；本地网关策略是最终授权点。外部源不得访问本地文件、其他凭证或任意内网地址。

## 3. 组件边界

### `apps/web`

负责用户旅程和状态显示，不负责解析私有二进制、保存秘密或拼接任意上游 URL。

- 地图首页、图层面板、导入入口、安全预览、结果回执。
- 摄像头扫码和二维码图片读取；解码后的载荷交给本地网关检查。
- 使用 OpenLayers 渲染网关提供的瓦片 URL。
- 响应式、键盘可用、无摄像头时图片上传等价。

### `apps/gateway`

本机唯一可信服务端边界。

- 接收输入、调用解析适配器、产生短时预览令牌。
- 在确认时重新校验选择、授权和 URL 策略。
- 保存开放模型、密钥引用、状态和回执。
- 代理已注册图源的瓦片，不接受任意上游 URL。
- 提供健康、迁移和脱敏诊断。

### `packages/source-schema`

唯一稳定内核：`MapSourceDefinition`、`ImportReceipt`、`ProbeResult`、状态机和错误码。

- 使用显式 `schemaVersion`。
- 区分原始解析值、用户修正值和派生值。
- Ovi 私有字段放在命名空间隔离的 compatibility extension。
- 渲染器只依赖规范字段。

### `packages/ovmap-codec`

纯函数式、不联网的版本化解析包。

流水线：

```text
bytes
→ size limit
→ magic/type sniff
→ bounded header read
→ version/codec dispatch
→ bounded decompression
→ bounded record parsing
→ raw layer records
→ normalization candidate
```

不得通过在任意偏移扫描 URL/坐标就声称完整解析。未知字段保留为受限原始扩展；未知版本返回稳定错误。

### `packages/qr-import`

把扫码后的文本/二进制载荷交给显式适配器。

- 开放 `.oms` QR。
- 已验证的奥维载荷版本。
- 普通 URL/文本只作为候选，不自动联网或导入。
- 原始载荷不进入普通日志。

### `packages/protocols`

将不同瓦片协议转换为规范请求计划。

- XYZ/TMS。
- WMTS tile matrix。
- WMS GetMap（只有样本需要时进入 V0）。
- ArcGIS REST tile。
- Ovi 变量如 `{$z}`、`{$x}`、`{$y}`、子域名、算术和时间字段通过受限模板解释器处理，禁止执行脚本。

### `packages/security`

- URL scheme/host/port/IP 检查。
- DNS 解析前后地址检查，防 DNS 重绑定。
- 私网、loopback、link-local、云元数据默认拒绝；按主机显式授权企业内网。
- 凭证字段识别、打码和日志清洗。
- 输入/解压/记录/字符串/请求/响应/缓存上限。
- 响应内容类型和图片解码验证。

## 4. 目标目录

```text
open-map-bridge/
├── apps/
│   ├── web/
│   └── gateway/
├── packages/
│   ├── source-schema/
│   ├── qr-import/
│   ├── ovmap-codec/
│   ├── protocols/
│   └── security/
├── fixtures/
│   ├── synthetic/
│   └── public-minimal/
├── docs/
│   ├── compatibility/
│   └── superpowers/specs/
├── goal.md
├── research.md
├── PROGRESS.md
└── BLOCKED.md
```

Fixture 不得包含真实长期秘密、用户隐私或未获再分发许可的大型资源。无 LICENSE 的公开仓库样本只在确认最小引用方式合法后纳入；否则测试运行时由用户本地提供并只保存哈希/预期元数据。

## 5. 核心数据模型

### MapSourceDefinition

```text
schemaVersion
id                  platform UUID
legacyId            optional Ovi map id
name
sourceKind           qr | ovmap | oms | manual
protocol             xyz | tms | wmts | wms | arcgis | ovi-template
projection
tileMatrix
minZoom/maxZoom
tileSize/format
transportScheme     http | https | unknown
hosts[]
pathTemplate
queryParameters      non-secret only
requestPlanProvenance per-field parsed/inferred/user-corrected/not-provided/redacted/legacy-unknown
credentialRef        opaque local reference
subdomainPolicy
overlayRelations
timeDimension
attribution/license/sourceProvenance
compatibilityExtension
status/timestamps
```

### 状态机

```text
received
  → parsed
  → confirmed
  → probed
  → rendered
  → saved

branch states:
invalid | unsupported | blocked | needs-credential | needs-data |
probe-failed | render-failed | stale | disabled
```

状态是事实，不是 UI 文案装饰。`parsed` 不能显示为“可用”；HTTP 200 不能直接进入 `rendered`。

### ImportReceipt

每次导入批次和每个图层都有脱敏回执。历史失败不可被后续成功覆盖；后续操作追加新事件。撤销记录影响范围和时间。

## 6. API 契约

### `POST /api/import/inspect`

- multipart 文件或 QR payload。
- 只做本地检查，不触发 DNS/HTTP。
- 返回短时 `previewId`、图层候选、风险、缺失项和稳定错误码。
- 输入达到上限立即拒绝；响应不回显完整秘密。

### `POST /api/import/{previewId}/confirm`

- 接收选中图层、用户授权确认和允许的修正。
- 网关从暂存区重新取得原始解析结果，不能信任前端重新提交的上游 URL。
- 执行安全策略和最小探测，逐项返回结果。

### `GET /api/tiles/{sourceId}/{z}/{x}/{y}`

- 只能访问已保存且活动的 source ID。
- 网关从定义和 credential vault 构造请求。
- 应用限流、缓存、超时、响应尺寸和类型检查。
- 禁止 query 参数覆盖上游 host/path，防止成为开放代理。

### `GET/DELETE/PATCH /api/sources/...`

提供列表、停用、重新验证、删除和允许字段编辑。编辑安全关键字段后状态退回 `confirmed` 或 `parsed`，必须重新探测。

### `GET /api/receipts/...`

返回脱敏事实；诊断导出同样经过秘密扫描。

## 7. `.ovmap` 兼容策略

### Codec registry

每个已支持家族注册：

```text
sniff(bytes) → confidence + family/version
decodeHeader(bytes) → bounded metadata
decompress(bytes, limits) → payload
decodeRecords(payload) → layer records + unknown fields
normalize(record) → MapSourceDefinition candidate
```

一个 codec 只能对明确匹配的家族负责。不能让“尝试所有解码直到不报错”成为成功条件。

### 兼容矩阵

为每个 fixture 记录：SHA-256、来源、授权/可保存方式、生成奥维版本（知道时）、头部、压缩方式、图层数、预期字段、未知字段和验证状态。

### 多图层与 ID

一个文件产生多个候选；每项独立选择。原始 ID 只保留为 `legacyId`，平台 UUID 避免冲突。替换已有图层必须明确确认并可撤销。

### `.sdb`

V0 识别 `.ovmap` 是否指向本地图层/缺少在线主机，并返回 `needs-data`。完整 `.sdb` schema、索引和瓦片读取属于后续独立规格，不能用空白画布冒充完成。

## 8. QR 兼容策略

二维码只是运输层。扫描完成后：

1. 记录载荷类型和哈希，不记录敏感全文。
2. 适配器离线识别格式和版本。
3. 输出一个或多个规范候选。
4. 进入与 `.ovmap` 完全相同的预览、确认、探测和保存链路。

若载荷指向远程配置 URL，inspect 阶段只显示 URL 和风险，不自动下载；用户确认后先用受限配置获取流程，再次预览解析结果，不能一步直达活动地图。

## 9. 安全与隐私设计

### SSRF

- 解析和确认之间零外联。
- 拒绝非 HTTP(S)、userinfo、畸形 IPv6、重定向到私网、危险端口和云元数据地址。
- 每次重定向和 DNS 结果重新检查。
- 企业内网采用显式 host/IP/CIDR 授权记录，不提供“一键允许所有内网”。

### 凭证

- UI 仅接收必要凭证；浏览器发送到 localhost 网关后不再次回显。
- credential vault 与普通 SQLite 模型分离；实现计划根据目标 OS 核验系统钥匙串或本地加密方案。
- 日志中查询参数按敏感键和熵启发式清洗；开发调试也不例外。
- 开放导出默认剥离凭证。

### 文件和压缩

- 流式大小限制、解压限额、记录数和字符串长度限制。
- 解析器无文件系统路径解释、无脚本执行、无网络。
- fuzz 和属性测试覆盖截断、随机字节、恶意长度和解压炸弹。

### 地图使用隐私

预览告知：外部图源可能看到出口 IP、瓦片 z/x/y、时间参数和访问频率。V0 不把这些行为上传到 OpenMapBridge 运营方。

## 10. 错误模型与恢复

稳定错误族：

- `INPUT_*`：二维码/文件读取和尺寸。
- `FORMAT_*`：魔数、版本、压缩、记录和字段。
- `POLICY_*`：协议、主机、端口、内网、授权和秘密。
- `CREDENTIAL_*`：缺失、占位、拒绝、过期。
- `PROBE_*`：DNS、TLS、超时、401/403/404/429/5xx、内容类型。
- `PROJECTION_*`：未知、矩阵不匹配、瓦片坐标无效。
- `DATA_*`：需要 `.sdb` 或其他配套数据。
- `RENDER_*`：图片损坏、透明空瓦片、错位待验证。
- `STORAGE_*`：保存、迁移、空间和恢复。

每个错误包含用户可见说明、可重试性、下一步和脱敏技术证据。重试只重复失败步骤；连续三次失败后停止自动重试。

## 11. 存储与缓存

- V0 用 SQLite 保存定义、状态、回执和迁移版本；具体驱动在实施任务 0 核许可证和平台支持。
- 密钥不放普通表，使用 credential reference。
- 预览暂存有 TTL，用户取消或过期后清除。
- 瓦片缓存有总量、单源和 TTL 上限；缓存键排除不可稳定共享的秘密但必须区分会改变响应的授权上下文。
- 磁盘空间低于安全阈值时停止新增缓存并提示，不删除用户原始文件。

## 12. 测试设计

### 单元与 golden tests

- `MapSourceDefinition` schema 和状态机。
- `.ovmap` 头部、zlib、单/多图层、未知字段和版本分派。
- QR 载荷适配。
- Ovi 模板变量和协议转换。
- URL/SSRF/秘密清洗。

### 恶意与属性测试

- 随机、截断、长度溢出、压缩炸弹、超长 URL、Unicode 混淆、重定向、DNS 重绑定、IPv4/IPv6 变体。
- 断言 inspect 阶段上游网络请求为 0。
- 断言日志、回执和开放导出不含 canary secret。

### 集成测试

使用本地可控 tile fixture server 模拟 200 图片、401、403、404、429、超时、重定向、错误 MIME、损坏图片和 CORS。它验证系统行为，不替代真实源验收。

### 浏览器 E2E

- 桌面拖入 `.ovmap`。
- 二维码图片上传。
- 支持环境的摄像头扫码。
- 多图层选择、部分成功、撤销。
- 刷新和网关重启恢复。
- 移动视口和键盘入口。

### 真实用户验收

至少一张用户有权使用的真实二维码和一个代表性 `.ovmap` 完成真实出图；公开旧 URL 只作解析 fixture，不在没有授权时作为在线验收。

## 13. 拉起与部署边界

开发入口目标：一个仓库命令启动 Web UI 和本地网关；正式 V0 提供 `docker compose up`，同时保留无需 Docker 的本地开发命令。端口、Node 版本、包管理器和镜像在实施任务 0 以当前环境和许可证实测后冻结。

V0 只绑定 localhost。公网部署会改变凭证、认证、CSRF、租户和代理风险，需要单独规格，不能把本地网关直接暴露到公网。

## 14. 开放扩展边界

V0 不执行第三方插件，但从第一天稳定以下边界：

- 版本化 source schema。
- 协议适配器接口。
- import receipt 和错误码。
- 图层状态事件。
- 开放 `.oms.json`。

未来插件 SDK、对象系统、遥感流水线和企业协作只消费这些公开契约，不读取 `.ovmap` 原始字节或密钥库。

## 15. 实施顺序与回滚

按 `goal.md` 的 SLICE-000 至 SLICE-007 执行。每个切片先有失败测试/fixture，再实现，再跑真实受影响旅程。数据库迁移必须可备份恢复；解析 codec 以新增版本方式演进，不用破坏旧 fixture 的就地改写。

任何切片出现秘密泄漏、无确认外联、开放代理、假成功或比已有 fixture 更差时，停止该切片并回到最近通过的 commit；不通过降低断言继续。

## 16. 已知边界

- 书面设计不证明任何代码已经存在。
- 当前只有一个 `.ovmap` 样本完成容器级观察，字段级 codec 尚未实现。
- 真实二维码验收依赖用户有权使用的样本或官方模板及用户自己的 token。
- `.sdb` 完整导入、企业协作、原生壳、对象系统和遥感视频均需后续规格。
- 依赖版本、许可证、安全公告和实际拉起命令必须在实施任务 0 当前核验，不能沿用记忆。

## 17. 规格自检

- 没有用 UI 相似度代替用户结果。
- 二维码和 `.ovmap` 共用一个模型和旅程。
- 解析、探测、渲染、保存的事实没有混报。
- 多图层、部分成功、未知版本、缺 `.sdb`、权限、取消、撤销和回访均有契约。
- 前后端信任边界、SSRF、秘密、解压和开放代理风险有明确控制。
- 自动测试和真实源验收分开。
- 本地 V0 与公网/企业/原生扩展边界没有混淆。
- 文档中没有未解释的占位实现承诺；实施前核验项已明确归入 SLICE-000。
