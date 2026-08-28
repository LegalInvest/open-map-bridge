# OpenMapBridge 本地运行手册

## 当前可运行范围

- 图源导入工作台（默认首页）：二维码图片、摄像头扫一扫和 `.ovmap` 点击/拖入；检查阶段零上游请求，显示脱敏预览，授权勾选后保存 `confirmed` 配置与回执，刷新/重启可恢复。
- 任务驾驶舱：对已保存图源执行“图源确认→静态网络策略→凭证准备→运行时绑定”四步准备度检查，持久显示阻塞和唯一下一动作；同一源配置与运行时状态重复触发返回同一任务。四步全部零外联，不证明瓦片可用。
- 二维码：支持开放 `oms1:` 和经真实样本验证的 `ovobj` 结构；`at/ad/al` 和不透明 `ul` 不回显、不持久化，图层会明确标记需要本机奥维桥接或后续凭证保险库。
- `.ovmap`：首个版本只支持 `OviO + record37-zlib` 家族；公开 455-byte 样本可列出 5 个图层。其他家族稳定拒绝，不承诺虚假全兼容。
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

## 导入验收

```bash
npm run fixtures:acquire
npm run fixtures:verify
npm run test:compat
npm run test:e2e
```

公开 fixture 只作本地 clean-room 解析证据，已 gitignore，不赋予其嵌入图源的使用权。授权真实二维码只做预览门时运行：

```bash
OMB_ACCEPTANCE_QR='/absolute/path/to/authorized-qr.png' npm run test:e2e:authorized-qr
```

该命令不会勾选授权或请求二维码中的服务器。默认 E2E 使用合成 QR 完成“预览→授权→保存→刷新恢复”，用合成五图层 `.ovmap` 完成选择旅程；授权本地门另外验证用户真实二维码和公开真实 `.ovmap` 的浏览器解码。

## 图源准备度任务

Web 操作：完成授权保存后点击“检查图源准备度”，或从顶部进入“任务驾驶舱”选择已保存图源。逐步查看状态、是否外联和下一动作。私网/裸 IP/企业域名/非标准端口默认停在企业主机人工门；云元数据地址永久阻断；疑似凭证被脱敏而未配置时停在凭证保险库门；没有运行时适配器时保持 blocked。

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

4. 四个请求必须都能由系统图像解码器归一化、非空、尺寸合理，且四个归一化 SHA-256 全部不同。经纬度必须合法，日期必须是四个不重复的 ISO 日期。临时图片在探测结束时删除。HTTP 200、官方客户端时间轴或导入成功都不能替代该证据。
5. 真实模式启动时由操作者在本机进程环境配置端口和地图类型；浏览器不能提交 host、URL、token 或地图类型。

```bash
OMB_OVI_PORT=<local-port> \
OMB_OVI_MAP_TYPE=<authorized-map-type> \
OMB_OVI_SOURCE_ID=<persisted-imported-source-uuid> \
npm run dev
```

三项必须一起配置且 map type 必须与目标导入源的 `legacyId` 匹配。网关只以显式 source UUID 建立 `configured` runtime；即使另一个源具有相同 legacy ID 也不会绑定。configured 源不会因配置存在而进入历史影像源列表。当前尚无自动真实探测/ready 晋级，不能用该启动命令证明影像可用。

## 数据真实性

- `requestDate` 是请求日期；奥维桥接不返回拍摄日期时，`captureDate` 保持空。
- 用户新建范围由网关生成 `area-*` ID 并保存为 `confirmed v1`；后续拖点并点击“确认当前范围”生成不可变新版本。
- 用户参考图生成的双湖红框仍是 `approximate`，不能冒充精确湖区边界。
- 影像只能记录可见变化。污染、过度养殖、渔猎或建设原因必须附独立监测、政府资料或论文证据。
