# OpenMapBridge 本地运行手册

## 当前可运行范围

- 图源导入工作台（默认首页）：二维码图片、摄像头扫一扫和 `.ovmap` 点击/拖入；检查阶段零上游请求，显示脱敏预览，授权勾选后保存 `confirmed` 配置与回执，刷新/重启可恢复。
- 本地凭证保险库：对普通 query/header 凭证提供 Web 密码输入；值经 AES-256-GCM 认证加密后写入独立 0600 文件，普通状态只保存同 source UUID 的不透明引用。奥维 `at/ad/al` 和不透明 `ul` 不属于通用字段，继续只走官方桥或专用适配器。
- 任务驾驶舱：对已保存图源执行“图源确认→静态网络策略→凭证准备→运行时绑定”四步准备度检查，持久显示阻塞和唯一下一动作；同一源配置与运行时状态重复触发返回同一任务。四步全部零外联，不证明瓦片可用。
- 二维码：支持开放 `oms1:` 和经真实样本验证的 `ovobj` 结构；图片原文件上限 8 MiB、解码前按 PNG/JPEG/WebP 文件头限制 16,777,216 像素，2×/3× 本地预处理也受相同像素预算约束；`at/ad/al` 和不透明 `ul` 不回显、不持久化，图层会明确标记需要本机奥维桥接或后续凭证保险库。
- `.ovmap`：首个版本只支持 `OviO + record37-zlib` 家族；公开 455-byte 样本可列出 5 个图层。原文件上限 1 MiB；客户端读取前预检，网关按精确 base64 膨胀和 4 KiB JSON 信封设置路由级上限。其他家族稳定拒绝，不承诺虚假全兼容。
- 浏览器工作台：在地图上框选任意矩形或多边形并命名，网关保存后自动覆盖最近 20 个完整 UTC 自然年，选四个不重复且尽量等距的日期，支持四屏对齐、卷帘、播放、缺年状态、AOI 修订和观察证据等级。
- 宝应湖、高邮湖只作为样例与回归夹具，不是产品边界。
- 默认图源：确定性的本地合成源。它只用于证明交互和状态，不是卫星影像。
- 真实奥维图源：只允许通过官方客户端的回环 Web 瓦片服务接入。未通过回环监听和四日期不同图片检查前，不得写成可用。

## 启动

要求 Node 24–26、npm 11、根卷至少 8 GiB 可用。低于 8 GiB 时停止安装、构建、测试、截图和影像缓存。

```bash
npm ci
npm run env:check
npm run dev
```

普通 Web 使用无需查看令牌：`scripts/dev.mjs` 会为本次进程生成临时 `OMB_GATEWAY_TOKEN`，只传给 gateway 和 Vite 服务端代理，不进入浏览器 bundle。需要直接使用 curl 时，必须在启动前自行设置至少 32 字符的随机本机秘密，并在同一 shell 中保留：

```bash
export OMB_GATEWAY_TOKEN="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"
npm run dev
```

应用只监听：

- Web：`http://127.0.0.1:5173`
- 网关：`http://127.0.0.1:4174`

按 `Ctrl+C` 同时停止两个服务。运行状态保存在 `data/temporal-state.json`；只保存开放定义和脱敏回执。二维码原图/载荷、`.ovmap` 原文件、真实瓦片、`at/ad/al`、不透明 `ul` 和奥维凭证不写入该文件。

如需在本机为普通 query/header 图源配置凭证，在同一 shell 中启用独立 vault；不要回显、提交或复制生成的 key 到文档/日志：

```bash
export OMB_VAULT_PATH="$PWD/data/credential-vault.json"
export OMB_VAULT_KEY="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"
npm run dev
```

`OMB_VAULT_PATH` 与 `OMB_VAULT_KEY` 必须成对设置，路径必须为绝对路径。vault key 只存在于进程环境或部署机 0600 环境文件；vault 文件只含认证加密 envelope。key 丢失或错误时网关启动失败关闭，不会把条目当作可用；备份/轮换流程尚未实现，故不要把此候选用于无法重置的唯一凭证副本。

未确认的导入预览只在进程内保存 15 分钟，并以最近使用顺序受 64 条/4 MiB 双限约束；过期或被 LRU 淘汰后需重新扫描/选择文件。二维码图片在创建 object URL、调用 ZXing 或分配放大 canvas 前执行字节、文件头尺寸和像素门，原图仍不上传网关。

## 导入验收

```bash
npm run fixtures:acquire
npm run fixtures:verify
npm run test:compat
npm run test:e2e
```

公开 fixture 只作本地 clean-room 解析证据，已 gitignore，不赋予其嵌入图源的使用权。授权真实二维码只做预览门时运行：

`.ovmap` 恰好 1 MiB 应越过 HTTP body 门并进入格式检查；多 1 字节返回 `INPUT_OVMAP_LIMIT` 413，编码信封超过路由预算返回 `INPUT_BODY_LIMIT` 413。不要通过提高全局 Fastify bodyLimit 处理该接口，也不要把 413 当成格式不支持。

```bash
OMB_ACCEPTANCE_QR='/absolute/path/to/authorized-qr.png' npm run test:e2e:authorized-qr
```

该命令不会勾选授权或请求二维码中的服务器。默认 E2E 使用合成 QR 完成“预览→授权→保存→刷新恢复”，用合成五图层 `.ovmap` 完成选择旅程；授权本地门另外验证用户真实二维码和公开真实 `.ovmap` 的浏览器解码。

## 图源准备度任务

Web 操作：完成授权保存后点击“检查图源准备度”，或从顶部进入“任务驾驶舱”选择已保存图源。逐步查看状态、是否外联和下一动作。私网/裸 IP/企业域名/非标准端口默认停在企业主机人工门；云元数据地址永久阻断；疑似凭证被脱敏而未配置、vault 未启用或引用不存在时停在凭证保险库门；没有运行时适配器时保持 blocked。凭证表单成功只证明加密存储和引用存在，不证明请求注入、服务器授权或瓦片有效。

本地 API：

```bash
curl -sS http://127.0.0.1:4174/api/v1/processes \
  -H "authorization: Bearer $OMB_GATEWAY_TOKEN"
curl -sS -X POST http://127.0.0.1:4174/api/v1/processes/source-readiness/execution \
  -H "authorization: Bearer $OMB_GATEWAY_TOKEN" \
  -H 'content-type: application/json' \
  -H 'x-omb-csrf: 1' \
  --data '{"sourceId":"<saved-source-id>"}'
curl -sS http://127.0.0.1:4174/api/v1/jobs \
  -H "authorization: Bearer $OMB_GATEWAY_TOKEN"
```

网关只接受精确回环 Host；出现不可信 Origin、`Sec-Fetch-Site: cross-site`、无效 Bearer、写请求缺 `x-omb-csrf: 1` 或超过限流时会 fail closed。创建接口只允许 `sourceId`，不能在 body 中传 URL、host、token 或跳步参数。当前没有 resume/cancel/results，也没有 DNS/HTTP/真实瓦片请求；这些属于下一切片。

## 历史影像合成源验收

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

E2E 使用本机 Chrome，先实际拖拽创建一个非湖泊矩形区域，检查服务端 ID、确认版本、自动四期和四屏加载；再以宝应湖、高邮湖检查共享视角、2012 缺年隔离、时间轴和卷帘。通过只说明开放工作台链路可运行，不说明真实历史影像可用。

## 官方奥维兼容性门

1. 启用前记录监听 socket；关闭状态应没有奥维 Web 端口。
2. 在官方客户端开启“第三方接口”后立即再次检查。只接受 `127.0.0.1` 或 `::1`；若为 `*`、`0.0.0.0` 或局域网地址，立即关闭。
3. 回环门通过后，用本机端口和已授权地图类型运行：

```bash
OMB_OVI_PORT=<local-port> \
OMB_OVI_MAP_TYPE=<authorized-map-type> \
OMB_PROBE_LONGITUDE=<longitude> \
OMB_PROBE_LATITUDE=<latitude> \
OMB_PROBE_DATES=2006-06-30,2012-06-30,2019-06-30,2025-06-30 \
node scripts/probe-ovi-bridge.mjs
```

这里的四个日期是操作者明确选择的最小探测输入，不是系统从图源发现的日期目录，也不能证明这些年份真实可用。生产 Ovi 适配器只接受由授权来源核验后注入的日期项；没有该目录时 `listDates` 明确拒绝，未知 `dateId` 在发出任何请求前返回未找到。

时序 HTTP 路径还有独立的服务器长度门。正常进入路由的非法日期/ID/坐标返回稳定 400 业务错误；超出 Fastify 参数长度门的路径会更早返回 414。不得为了把两者统一成同一 JSON 错误而放宽服务器 URL 门。SDK 和直接适配器调用仍在发请求前执行共享 schema。

4. 四个请求必须都能由系统图像解码器归一化、非空、尺寸合理，且四个归一化 SHA-256 全部不同。经纬度必须合法，日期必须是四个不重复的 ISO 日期。临时图片在探测结束时删除。HTTP 200、官方客户端时间轴或导入成功都不能替代该证据。
5. 真实模式启动时由操作者在本机进程环境配置端口和地图类型；浏览器不能提交 host、URL、token 或地图类型。

```bash
OMB_OVI_PORT=<local-port> \
OMB_OVI_MAP_TYPE=<authorized-map-type> \
OMB_OVI_SOURCE_ID=<persisted-imported-source-uuid> \
OMB_OVI_VERIFIED_DATES_JSON='<strict TemporalDateEntry JSON array>' \
OMB_OVI_PROBE_JSON='<one registered {dateId,z,x,y} JSON object>' \
npm run dev
```

前三项必须一起配置且 map type 必须与目标导入源的 `legacyId` 匹配。日期 JSON 最多 500 项，只允许 `id/requestDate/captureDate/precision/availability`；额外字段失败关闭，`provenance` 由网关写成固定非秘密值。probe 必须引用其中一个非 `missing/failed` 日期，不能包含 token、Cookie、host 或私有认证值。网关只以显式 source UUID 建立 runtime；即使另一个源具有相同 legacy ID 也不会绑定。未配置 probe 时保持 configured 且不产生 ProbeResult。已配置 probe 时，网关以同 source UUID、导入 SHA、回环 origin、mapType、排序日期目录和 probe 坐标形成安全输入指纹；首次成功或失败都先原子持久化脱敏 ProbeResult，同指纹重启直接复用且不重复请求。只有状态 200、非空、PNG/JPEG 完整解码和尺寸门全部通过并持久成功证据后才标 ready；失败保持 configured。当前没有显式“重试同指纹”操作，配置事实变化会产生新指纹；不要通过手改状态触发重试。单瓦片通过仍不证明四期互异、真实日期目录或用户业务验收。

## 数据真实性

- `requestDate` 是请求日期；奥维桥接不返回拍摄日期时，`captureDate` 保持空。
- 旧时序 API、V1 开发者 API、SDK 和适配器共用严格输入规则：实际 ISO 日历日期、非反向窗口、1–160 字符无首尾空白/控制符的 AOI/date ID，以及 z≤30、x/y<2^z 的规范十进制瓦片坐标；无效输入在适配器请求前失败。
- 用户新建范围由网关生成 `area-*` ID 并保存为 `confirmed v1`；后续拖点并点击“确认当前范围”生成不可变新版本。
- 用户参考图生成的双湖红框仍是 `approximate`，不能冒充精确湖区边界。
- 影像只能记录可见变化。污染、过度养殖、渔猎或建设原因必须附独立监测、政府资料或论文证据。

## 生产制品与服务器部署

运行 `npm run build && npm run test:production` 生成并验证 `dist/open-map-bridge/`。制品包含独立 gateway、Web 静态资源、manifest、许可证和 loopback systemd/nginx 模板；冒烟测试会把制品复制到临时 release 目录，证明运行时不依赖仓库 TypeScript 源码，并验证鉴权健康、未鉴权拒绝、原子持久化和 SIGTERM 正常退出。

首个服务器契约只允许 nginx 与 gateway 监听回环，由 SSH tunnel 访问。真实 token 只进入服务器 `0600` 环境文件和 nginx include，不进入仓库、Web bundle、命令回显或日志。完整安装、回滚和验收边界见 [`deployment.md`](deployment.md)。
