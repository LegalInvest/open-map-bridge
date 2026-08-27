# OpenMapBridge 现实、证据与工程研究总线

## 1. 任务与研究边界

### 用户裁决摘要

- 目标：开发开源、可二次开发的奥维同类地图平台。
- V0：扫描真实奥维图源二维码或导入 `.ovmap`，安全预览后真实出图并保存。
- 形态：全平台为长期方向；若原生拖慢，Web UI 可接受；重点是能实际拉起运行。
- 2026-08-27 用户已批准聊天中的 V0 方向，并明确回复“书面规格批准”；当前阶段为 `spec-approved / plan-ready`。
- 2026-08-27 用户提供并授权试用一张“奥维高清历史影像91”二维码；要求同一个图源选择多个历史年份，并批准“官方奥维本机桥接＋开放 Web 对比核心”。
- 首批业务验收：宝应湖、高邮湖用户框选区域 2006–2025 的对齐影像、四期对比和时间播放；污染、过度渔猎/养殖或开发原因只作为待验证假设。

### 本轮回答

- 固化产品旅程、规则、数据、接口、安全和验收。
- 记录当前 `.ovmap`/二维码证据、开源候选、项目资产和技术推荐。
- 当前增量先更新规格与计划，再用 TDD 开发；不抓取大范围地图、不部署公网、不连接企业服务器。
- 2026-08-27 当前实现已完成合成源上的四屏、卷帘、播放、缺年状态和观察证据等级；31 个测试、类型检查和生产构建通过。该结论仍是 `local-verified` 代码证据，不代表真实奥维瓦片已经可用。

### 搜索与核验边界

- 外部事实截止：2026-08-27。
- GitHub “穷尽”仅指公开、未删除、可被 GitHub 搜索索引并被已执行查询族命中的仓库；私有、删除、未索引和改名资产不在可证明范围。
- 公开图源样本只用于格式兼容证据，不代表数据授权、稳定服务或可再分发。

## 2. 生成与供稿溯源

### 生成方式

- 整合者：本 Codex 主线程；未使用新 subagent。
- 研究方式：当前线程内官方文档检索、GitHub 仓库/代码检索、公开样本最小字节检查、本地工作区只读盘点。
- 规格深度：新产品完整 PRD，当前实现切片为 V0 导入闭环。
- Leader Skill：`/Users/assis/.codex/skills/leader/SKILL.md`
- Skill SHA-256：`477ed37e9381a866cc04622fee62a5ab167208d2db77ae03e04eaf13c26f6e8c`
- Skill 修改时间：`2026-08-24T17:21:56+0800`
- 已完整读取：`product-specification.md`、`anatomy.md`、`context-acquisition.md`、`dual-translation.md`、`evolution.md`
- reference SHA-256：
  - product-specification：`56d2f5d083c2d4074109fe3c9b9a04542a858d849754be5fdb1394d93cc70a40`
  - anatomy：`99492cea539426065460fa4c482d609460d09a4e3b87b5a4dcb0586bd9b52c08`
  - context-acquisition：`c4efe9db9b728e2ffe1f19d26d8c6f6005b3f1650afbfe7b9bc079a5587d6608`
  - dual-translation：`4dd5898ddbaed2450eccde27954db2a2c483fa53c7fa0db53bfa7eadc8220915`
  - evolution：`81b732cf786e71f318808c2752fc46aa704bd8e54ba108b73873dd4e78608676`

不得把聊天中出现的账号、口令、密钥或服务器密码写入项目。本文件没有保存这些秘密。

## 3. 产品证据地图

| 来源 | 日期/核验 | 支持结论 | 局限 |
|---|---|---|---|
| 用户当前线程原话与附件 | 2026-08-27 | 已提供真实历史图源二维码和双湖框选参考图；批准方案 A；要求 20 年对比 | 双湖截图无空间参考，边界只能先 approximate；真实源日期目录尚未成功枚举 |
| [奥维：扫描二维码添加自定义地图](https://www.ovital.com/137268-2/) | 2026-08-27 | 官方确认二维码可分享/导入自定义地图，手机一次扫描一个 | 未公开二维码线协议 |
| [奥维：导入文件或扫描二维码](https://www.ovital.com/142734-2/) | 2026-08-27 | 官方确认自定义地图可保存为图片或奥维专属 `.ovmap` 并分享 | 视频页面未给出二进制 schema |
| [奥维文件格式说明](https://www.ovital.com/139064-2/) | 2026-08-27 | `.ovmap` 是自定义地图格式；可导出分享后再导入 | 没有字段和版本文档 |
| [奥维移动端导入自定义航拍图](https://www.ovital.com/131807-2/) | 2026-08-27 | 本地航拍迁移时 `.ovmap` 与 `.sdb` 二者缺一不可；地图 ID 冲突有覆盖/取消语义 | 只覆盖官方工作流，不描述所有历史版本 |
| [奥维在线自定义地图](https://www.ovital.com/131425-2/) | 2026-08-27 | 官方配置字段包括 ID、名称、级别、投影、格式、尺寸、主机、端口、URL 和 token | 示例不等于所有私有记录字段 |
| [奥维 WMTS 导入](https://www.ovital.com/147808/) | 2026-08-27 | WMTS 可解析生成自定义地图并支持自定义 token 参数 | 当前版本能力可能继续变化 |
| [奥维多时相地图](https://www.ovital.com/147525/) | 2026-08-27 | URL 支持时间变量，证明统一模型需预留时间维度 | V0 不实现完整遥感时间流水线 |
| [奥维 Web 瓦片服务](https://www.ovital.com/132277-2/) | 2026-08-27 | 官方接口路径包含日期参数，`yyyyMMdd` 按日期请求，`0` 为最新 | 尚未证明特殊 GEE 历史源能通过该接口按需出图，也未证明只监听回环 |
| [奥维 Tableau 调用示例](https://www.ovital.com/146671/) | 2026-08-27 | 第三方程序可调用本机瓦片服务，日期表示目标日前的影像 | 不能据此获得真实拍摄日期目录 |
| [OpenLayers Layer Swipe](https://openlayers.org/en/latest/examples/layer-swipe.html) | 2026-08-27 | 可直接复用卷帘渲染原语 | 示例不包含多时相数据和 Ovi 认证 |
| [MapStore2](https://github.com/geosolutions-it/MapStore2) | 2026-08-27 | 有时间维度、时间线和 Swipe 的成熟开源行为参考 | 平台较重，仍不解决 Ovi 私有认证；不作为首版底座 |
| [EO Browser](https://github.com/sentinel-hub/EOBrowser) | 2026-08-27 | 日期搜索、pin、透明度和 split compare 是可复用产品参考 | 外部部署依赖 Sentinel Hub 身份与服务，不适合作为 Ovi 兼容底座 |
| [江苏省农业农村厅高宝邵伯湖养殖水域滩涂资料](https://nynct.jiangsu.gov.cn/module/download/downfile.jsp?classid=0&filename=4e59a3178dec41fda94e6a596ebc228f.pdf) | 2026-08-27 | 官方资料给出宝应湖限制养殖区和高邮湖保护区坐标，可作为后续外部证据线索 | 不等于用户红框精确边界，也不证明影像中的变化原因 |
| [金湖县高邮湖宝应湖退圩还湖规划批复说明](https://www.jinhu.gov.cn/col/1401_768714/art/20190412091534_JCcoAOKV.html) | 2026-08-27 | 官方说明 2018 年启动退圩还湖规划，目标含恢复调蓄和改善水质 | 只能作为历史治理背景，不能替代影像和水质数据的逐项对齐 |
| [星图云奥维二维码教程](https://open.geovisearth.com/service/qa-assistance/159) | 2026-08-27 | 合法二维码模板可要求用户自行替换官方 token | 只代表星图云场景 |
| [soneverdance/ovital](https://github.com/soneverdance/ovital) | 2026-08-27 | 公开二维码和 `.ovmap` 样本，可用于兼容研究和 golden fixture 候选 | 仓库无明确 LICENSE；图源权利和 token 合规未知，不能复制/再分发全部资源 |

## 4. 用户与当前旅程

### 已证实角色

- 用户本人是希望把奥维生态开放化的产品裁决者和首位验收者。
- 目标用户持有二维码/`.ovmap`，但不应被要求理解二进制、URL 变量或 CORS。

### 现行旅程

1. 从好友、社区、卖家或服务商获得二维码/`.ovmap`。
2. 在奥维扫码或导入。
3. 图层加入自定义地图列表。
4. 选择图层后才知道服务器是否可用、token 是否有效、投影是否正确。
5. 失败时依赖手工修改、卖家售后或换源；缺少统一、透明的诊断和开放迁移。

### 目标旅程差异

- 把“联网和出图”延后到用户看清配置并确认之后。
- 把解析、授权、探测、渲染、保存分成可观察状态。
- 把封闭配置转为开放模型和可迁移回执。

## 5. 业务对象与口径

| 对象 | 当前事实 | 状态/口径 | 来源 |
|---|---|---|---|
| QRInput | 图片/摄像头中的编码载荷 | 输入，不等于合法图源或可用地图 | 用户文件/摄像头 |
| OVMapFile | 奥维自定义地图配置容器 | 可能单图层/多图层；在线配置通常不含瓦片 | 用户文件 |
| MapSourceDefinition | 目标开放内部模型 | planned；需版本化 | 平台解析/用户修正 |
| CredentialRef | token 等秘密引用 | 明文不得进入普通模型/日志 | 用户本地输入 |
| ImportReceipt | 脱敏事实账本 | planned；每批/每图层 | 平台生成 |
| ProbeResult | 最小网络探测结果 | HTTP 成功不等于渲染成功 | 本地网关 |
| SDB companion | 奥维离线地图数据 | V0 只识别依赖，完整导入 planned | 用户文件 |

## 6. 资产与环境地图

### 本地

| 资产 | 状态 | 证据 | 最后核验 |
|---|---|---|---|
| 项目目录 | 新建 `/Users/assis/Documents/Codex/2026-08-27/open-map-bridge` | 本轮文件系统创建 | 2026-08-27 |
| 既有同类本地仓库 | 未发现 | `find /Users/assis/Documents/Codex -maxdepth 2` 仅命中既有 VegFlow mapping 目录，无 Ovi/OpenMapBridge 项目 | 2026-08-27 |
| Git 仓库 | 已初始化本地 `main`；首个规格 commit `5abe01b`；无 remote | `git log -1 --oneline`、`git status --short` | 2026-08-27 |
| 根卷空间 | 最近一次复核约 17 GiB 可用；此前同日曾低至约 484 MiB，临时安装包已清理 | `df -h /` | 2026-08-27 |
| Node/Docker 工具链 | 本机 Node `v26.7.0`、npm `11.19.0`、Docker `29.4.0`、Compose `5.1.2`；计划冻结 Node `24.20.0` LTS 作为目标运行时 | 版本命令；[Node 官方发布表](https://nodejs.org/en/about/previous-releases) | 2026-08-27 |
| 奥维桌面客户端 | 先发现旧 2.6.3；随后从官方分发安装并验签 10.6.0 到独立应用路径，未覆盖旧版 | 应用版本、代码签名、公证和官方安装包校验 | 2026-08-27 |

### 2026-08-27 官方客户端实测增量

- 从奥维官方分发地址取得并校验签名/公证的 macOS 10.6.0，保留安装于 `/Applications/OMapQT-10.6.0.app`；旧 2.6.3 应用未覆盖。
- 用户二维码通过官方客户端真实导入，名称“奥维高清历史影像91”、legacy ID 200，被识别为“GEE 协议历史影像”；主界面出现日期时间轴。
- 二维码载荷头为 `ovobj`，包含协议入口、认证和连接参数；认证区为不透明二进制，未发现明文年份。任何 host/key/载荷全文均未进入项目文件。
- 导入后远端日期目录/瓦片仍停在下载状态；因此目前确认“单码多时相协议和时间轴存在”，尚未确认具体年份列表或真实瓦片。
- 官方 Web 瓦片服务开关尚未启用；启用前必须证明只能由本机回环访问。若只能监听所有网卡，保持关闭。
- 根卷在清理本轮临时 DMG/PDF 渲染缓存后约 17 GiB 可用；已安装应用和导入数据保留。

### GitHub 与远端

- 当前机器 GitHub CLI 在此前同线程核验为已登录账号 `LegalInvest`；当前项目尚无主仓、remote、main 或 CI。
- 用户批准产品方向不等于授权创建远端仓库、推送、公开发布或部署；这些阶段必须单独取证和遵循目标范围。
- 两台云服务器不在当前 V0 规格交付范围，本轮未连接。

## 7. `.ovmap` 当前二进制证据

### 样本

- 来源：[soneverdance/ovital 的“腾讯地图5种.ovmap”](https://github.com/soneverdance/ovital)
- GitHub API 报告大小：455 bytes。
- 最小命令只在内存中读取公开文件，没有落盘、没有请求其中的图源：

```sh
curl -sSL --max-time 15 '<public-raw-url>' |
python3 -c 'read bytes; inspect header; zlib.decompress(bytes[24:]); list ASCII strings'
```

### 观察事实

- 前四字节：ASCII `OviO`。
- 该样本偏移 `0x18` 开始为 `78 01`，可作为 zlib 流解压。
- 解压后 4209 bytes。
- 解压内容中出现多个主机和 URL 模板，包括 `{$serverpart}`、`{$z}`、`{$x}`、`{$y}` 以及分块表达式。
- 文件名和内容共同支持“一个 `.ovmap` 可装多个图源配置”。
- 解压 payload 的五条记录起点为 `0x0000/0x0347/0x0695/0x09e2/0x0d25`；每条总长度等于首个 little-endian `recordLength + 8`，最后一条准确结束于 4209 bytes。
- 当前样本中，记录偏移 24 是地图 ID、偏移 32 是最大级别；偏移 128 起连续四个 little-endian 长度前缀 UTF-8 字符串依次表现为名称、主机、URL 模板和系列名。这些仅作为 `record37-zlib` 家族证据，不外推到所有版本。

### 不得跨越的推断

- 不能据一个样本断言所有 `.ovmap` 都固定从 24 字节开始 zlib。
- `OviO` 也可能被其他奥维私有文件使用，必须识别内部对象类型/版本，不能只看魔数。
- 能解压出 URL 不等于字段边界、投影、叠加层或秘密已经正确解析。
- 样本中的上游 URL 不自动获得授权，不作为默认在线验收源。

## 8. 二维码当前证据

- 官方确认二维码可以导入自定义地图，但没有公开线协议。
- 使用 macOS Vision 对公开二维码做内存级结构检查：QR payload 长 271 bytes，头为 `ovobj`，查询键顺序为 `t,id,na,po,he,oy,df,hn,ul`；没有输出或保存这些键的值。字段 `id/na/hn/ul` 的业务表现可作为首版候选，其他代码保持原值，待差分证据确认。
- 星图云官方二维码场景需要用户导入后替换自己的 token，证明二维码可能只含模板或占位凭证。
- V0 必须同时支持摄像头和图片上传；无摄像头不得阻断旅程。

## 9. 开源来源与复用判断

| 候选 | 可复用价值 | 许可证/风险 | 当前决定 |
|---|---|---|---|
| [CandyACE/tilegrabber](https://github.com/CandyACE/tilegrabber) | `.ovmap`、WMTS/TMS/XYZ、下载和多种发布格式的强行为参考 | README 有 MIT 徽章但此前核验未见 LICENSE，GitHub 为 NOASSERTION | 只作行为/测试思路证据；获得明确许可前不复制代码 |
| [Anguskk/OmapInterface](https://github.com/Anguskk/OmapInterface) | 奥维官方 IPC 的 C++/Qt 包装参考 | 未见明确 LICENSE | 仅参考接口形态，不纳入 V0 代码 |
| [ruiduobao/convert-ovobj-to-shp](https://github.com/ruiduobao/convert-ovobj-to-shp) | 保守 `OviO` 点对象解析思路 | README 声称 MIT-0，但独立 LICENSE 状态需复核 | OVOBJ 后续研究候选，不用于 `.ovmap` V0 |
| [Fangster-1/ovkml-converter](https://github.com/Fangster-1/ovkml-converter) | 格式 fixture、测试组织、OVKML/OVJSN 工作流 | 未见明确 LICENSE；OVOBJ 解析部分为启发式 | 后续对象层证据，不复制代码 |
| [soneverdance/ovital](https://github.com/soneverdance/ovital) | 大量二维码和 `.ovmap` 兼容样本 | 无明确 LICENSE、图源权利不一、可能含 token | 只挑最小、脱敏、合法 fixture；不随产品分发整个仓库 |
| [Vincentdu-cn/ouv-map](https://github.com/Vincentdu-cn/ouv-map) | React 地图工作台和导入 UI 原型 | README 声称 MIT但未见 LICENSE；把 `.ovobj` 当 JSON | 只作产品界面参考 |
| [iiecho1/ov-map](https://github.com/iiecho1/ov-map) | Leaflet 工作台、绘制和简单云接口原型 | 未见 LICENSE；无真实 Ovi 格式 | 不作为内核 |
| [lzl-pro-pro/ovital-survey](https://github.com/lzl-pro-pro/ovital-survey) | 外业调查、CAD/KML/照片等下游旅程 | 无 README/许可证/测试 | 后续行业插件研究 |
| [leekwan/ovital-offline-map](https://github.com/leekwan/ovital-offline-map) | MIT UI 草图 | 静态核验发现 QR 无摄像头、OVOBJ 误当 XML、3D 仅 CSS | 明确拒绝作为兼容基础 |
| OpenLayers | 多投影、自定义瓦片矩阵、传统栅格协议适合 V0 | 具体版本、许可证和安全公告实施前复核 | 推荐二维渲染器，状态 `discovered` |
| Node/TypeScript 本地网关 | 可共用 schema，内置 zlib，易以 Web UI 快速拉起 | 框架和版本未锁定 | 推荐实现方向，实施计划前核验 |
| SQLite | 单机配置/回执存储，易迁移和备份 | 驱动与迁移方案未锁定 | 推荐 V0 持久层 |

2026-08-27 计划阶段通过 npm registry 当前元数据核验并冻结：OpenLayers `10.10.0`（BSD-2-Clause）、ZXing Browser `0.2.1`（MIT）、Fastify `5.12.1`（MIT）、better-sqlite3 `13.0.3`（MIT）、React `19.2.8`（MIT）、Vite `8.2.2`（MIT）、Zod `4.4.3`（MIT）、Vitest `4.1.11`（MIT）和 Playwright `1.62.1`（Apache-2.0）。实施任务 0 仍须生成锁文件并复核传递依赖与安全公告。

## 10. 方案、假设与裁决

| 编号 | 问题 | 选项 | 裁决/状态 | 猜错代价 |
|---|---|---|---|---|
| DEC-001 | 首版终端 | 纯 PWA / Web UI＋本地网关 / 原生优先 | 用户批准 Web 可先行；选 Web UI＋本地网关 | 若用户只接受原生，需增加壳但核心仍复用 |
| DEC-002 | 兼容入口 | QR 优先 / `.ovmap` 优先 / 两者同一切片 | 用户要求通用；两者均为 V0 硬入口 | 解析工作增加，但避免形成第二套内核 |
| DEC-003 | 优先级 | 全量奥维功能 / 最短真实闭环 | 用户明确“重点是能跑起来拉起来”；最短闭环优先 | 长尾功能延期，不影响核心证明 |
| DEC-004 | 离线数据 | V0 完整 `.sdb` / V0 识别依赖 | 暂定 V0 识别并准确报 `needs-data`，完整导入后续 | 若用户要求 V0 离线航拍实显，需要扩大切片和样本 |
| DEC-005 | 内部格式 | 继续以 `.ovmap` 为真值 / 开放 schema 为真值 | 选开放 schema，Ovi 是边界适配器 | 需要设计迁移，但避免再次锁定 |
| DEC-006 | 品牌 | 使用奥维名称 / 独立品牌 | 工作名 OpenMapBridge，正式独立品牌 | 避免商标和官方关联风险 |
| DEC-007 | 历史源接入 | 直接复现私有 GEE / 官方客户端桥接 / 只用开放遥感源 | 用户批准官方客户端本机桥接＋开放适配器 | 桥接受官方客户端运行态约束，但最快验证真实二维码且不绕过认证 |
| DEC-008 | 20 年口径 | 滚动 20 年 / 2006–2025 / 2000–2025 | 首批验收固定 2006–2025 共 20 个完整自然年 | 若用户需要 2000–2025，日期模型可扩展但测试规模增大 |
| DEC-009 | 双湖边界 | 直接像素转经纬度 / approximate 预设后用户确认 | 选后者；截图无空间参考，不冒充精确边界 | 首次多一步确认，但避免错区验收 |
| DEC-010 | 环境结论 | 影像自动判定污染 / 影像观察＋外部证据门 | 选证据门 | 结论更慢，但避免把季节、水色、传感器差异写成污染因果 |

## 11. 推荐系统与代码地图（绿地 planned）

目标目录边界：

```text
apps/web                 响应式地图与导入 UI
apps/gateway             本地 API、凭证、策略、瓦片代理、持久化
packages/source-schema   MapSourceDefinition、状态机、错误码
packages/qr-import       QR载荷适配
packages/ovmap-codec     嗅探、有界解压、版本记录解析
packages/protocols       XYZ/TMS/WMTS/WMS/ArcGIS 等归一化
packages/security        URL/SSRF/秘密/日志策略
fixtures                 最小合法和合成测试样本；不存真实长期秘密
docs                     规格、开放格式和兼容矩阵
```

建议数据流：

```text
QR/文件 → 纯本地 inspect → version adapter → MapSourceDefinition preview
→ 用户授权确认 → gateway policy → minimal probe → source registry
→ tile proxy → OpenLayers render → receipt + persisted state
```

上述时序路径中的日期事实、AOI、网关、四屏、卷帘、播放和观察面板已经实现；QR/`.ovmap` 通用导入主线仍是 planned。当前没有 CI、远端制品、公网部署或真实奥维瓦片验收。

历史影像增量目标路径：

```text
packages/temporal-source     日期事实、适配器、帧回执
packages/aois                GeoJSON 验证、版本和双湖预设
apps/gateway/src/temporal    OviBridge、合成 fixture、受控日期瓦片路由
apps/gateway/src/aois        AOI 版本和比较持久化
apps/web/src/history         双湖工作台、日期目录、播放与观察
apps/web/src/map             共享 ViewState、四屏和卷帘
fixtures/synthetic/temporal  无外网的 20 年彩色/带标签时序瓦片
```

这些路径在本次文档更新时仍为 `planned`，不得写成已实现。

## 12. 已核验基线

| 层 | 事实 | 阶段 | 证据 |
|---|---|---|---|
| 产品裁决 | V0 方向和书面规格均获用户明确批准 | spec-approved | 当前线程 |
| 书面规格与实施计划 | `goal.md`、`research.md`、设计文档和 10 项实施计划已落盘 | spec-approved / plan-ready | 本地文件、Git commit 与用户回复 |
| 实施计划 | `docs/superpowers/plans/2026-08-27-open-map-bridge-v0-import.md`，10 个任务、81 个步骤 | plan-ready，待选择执行方式 | 本地计划文件与计划自检 |
| 现有产品 | Web＋本地网关已有一键运行入口 | local-candidate | `npm run dev`；仅回环监听 |
| `.ovmap` 魔数/压缩 | 一个公开样本完成内存级观察 | discovered | 第 7 节命令与结果 |
| 二维码协议 | 官方确认流程；私有载荷字段未建 fixture | discovered | 官方文档、同线程观察 |
| 用户历史二维码 | 官方奥维 10.6.0 已真实导入并识别 GEE 历史协议，时间轴出现 | discovered / official-client-imported | 官方客户端可见行为；具体日期与瓦片尚未返回 |
| 双湖 AOI | 用户提供含两块红框的参考图 | discovered / approximate | 当前附件；无空间参考，尚未形成确认 GeoJSON |
| Ovi Web 桥接 | 官方文档证明接口形态；本地适配器已验证只接受回环 origin、年度请求日期和 5 MiB 上限；本机官方服务尚未启用和请求 | adapter local-verified / real compatibility-gate blocked | `apps/gateway/src/temporal/ovi-bridge.ts` 与 6 个相关测试；需验证官方监听和特殊历史源出图 |
| 时序 Web UI | 四屏、卷帘、播放、AOI 编辑和观察面板已实现 | local-candidate | Chrome E2E 通过；真实源未过门 |
| 时序工作区基线 | 隔离分支已建立；环境门、精确依赖锁和四个空 workspace typecheck 通过 | local-candidate / scaffold-only | `npm run env:check && npm test && npm run typecheck`；Node 26.7.0、npm 11.19.0、197 packages、0 vulnerabilities；2026-08-27 |
| 自动测试 | 单元/组件/网关/环境门和 Chrome E2E 均已运行 | local-verified | `npm test`、`npm run typecheck`、`npm run build`、`npm run test:e2e` |
| GitHub main | 无主仓 | missing | 未创建远端 |
| 部署 | 无 | missing | 未授权/未实施 |
| 业务验收 | 无真实 Web UI 旅程 | missing | 未实施 |

## 13. 规格—代码—发布追踪矩阵

| ID | 产品目标/行为 | 当前现实 | 目标路径/接口 | 测试/E2E | 阶段 | 差距/阻塞 | 最后核验 |
|---|---|---|---|---|---|---|---|
| JRN-001 / FR-001 | 真实二维码到出图 | 无实现 | `apps/web`、`packages/qr-import` | AC-001 | planned | 缺合法真实 QR fixture、代码 | 2026-08-27 |
| JRN-002 / FR-002 | 多图层 `.ovmap` | 仅观察一个样本 | `packages/ovmap-codec`、IF-001 | AC-002/003 | discovered | 缺字段级解析和版本矩阵 | 2026-08-27 |
| FR-003 / DATA-001 | 统一开放模型 | 规格已定义字段 | `packages/source-schema` | schema round-trip | planned | 缺 schema 与迁移代码 | 2026-08-27 |
| FR-004 / BR-004/005 | 安全预览、零外联、秘密 | 仅规格 | `packages/security`、UI-003 | AC-004/009 | planned | 缺威胁测试和密钥方案 | 2026-08-27 |
| FR-005 / IF-003 | 代理和真实渲染 | 仅推荐架构 | `apps/gateway`、`apps/web` | AC-005/007 | planned | 缺协议、CORS、SSRF和真实源 E2E | 2026-08-27 |
| FR-006 / DATA-002 | 保存、回执和重启恢复 | 仅规格 | gateway persistence | AC-006 | planned | 缺数据库选择核验、迁移和删除语义 | 2026-08-27 |
| FR-007 | 部分成功和诊断 | 仅规格 | UI-004、receipt service | AC-003/008/009 | planned | 缺错误码和反例 fixture | 2026-08-27 |
| FR-008 / IF-004 | 开放导出 | 仅规格 | source-schema export | AC-010 | planned | 缺开放 schema 文档与 QR 容量策略 | 2026-08-27 |
| NFR-001 | SSRF/解压/开放代理防护 | 风险已识别 | security/gateway | 恶意反例套件 | planned | 缺实现与红→绿证据 | 2026-08-27 |
| NFR-007 | 合法开源依赖 | 候选已发现 | lockfiles、THIRD_PARTY | license audit | discovered | 版本/许可证/安全公告待任务0复核 | 2026-08-27 |
| AC-001 至 AC-010 | 业务验收 | 均未运行 | E2E + 真实浏览器 | 对应 AC | missing | 无代码入口 | 2026-08-27 |
| JRN-007 / FR-009 | 历史源日期和真实瓦片 | 日期事实、合成 20 年源、安全 OviBridge、注册源瓦片 API 已本地验证；官方客户端仅导入成功 | `packages/temporal-source`、`apps/gateway/src/{temporal,routes/temporal}.ts` | gateway/contract suite 22 tests；AC-011 未运行 | synthetic local-verified / real adapter blocked | 官方日期目录仍下载；Web 服务未启用 | 2026-08-27 |
| JRN-008 / FR-010 | 双湖 AOI 确认 | GeoJSON 校验、两个独立 approximate 预设和不可变版本追加已本地验证 | `packages/aois/src/{schema,presets}.ts`；editor planned | 5 unit tests；AC-012/013/014 未运行 | contract local-verified / UI missing | 预设不是精确边界；缺地图编辑确认 | 2026-08-27 |
| JRN-009 / FR-011/012 | 四屏、卷帘和播放 | 四屏、逐屏状态、共享/回放 ViewState、卷帘、播放和缺年隔离均已本地构建 | `apps/web/src/history` | UI/sync tests + Chrome E2E passed | synthetic local-verified | 真实奥维源和用户 AOI 未接受 | 2026-08-27 |
| FR-013 / BR-014 | 变化观察证据等级 | 可见对象、原因假设和独立证据门已实现 | `apps/web/src/history/ObservationPanel.tsx` | component tests passed；AC-016 synthetic-only | UI local-verified | 尚无真实观察、外部逐年证据或用户接受 | 2026-08-27 |

阶段计数不能跨级汇总：合成链路已有 `local-verified`；开放工作台整体为 `local-candidate`；真实奥维、`main`、`deployed` 和用户 `accepted` 均未达到。

## 14. 风险与未决项

1. **协议漂移**：`.ovmap` 可能跨版本改变头部、压缩、字段和记录布局。对策是显式适配器和 golden fixture，不做无边界扫描。
2. **二维码私有协议**：官方未公开 wire schema。需要合法样本、独立观察和失败关闭。
3. **许可证**：多个最相关 GitHub 候选没有明确 LICENSE；只能借鉴行为，不复制代码。
4. **图源授权**：公开配置可能盗链或含共享 token。产品必须显示来源未知并要求用户确认，不内置。
5. **SSRF/秘密**：本地代理天然高风险。客户端不能传任意 URL；后端策略为最终裁决。
6. **投影正确性**：HTTP 200 图片仍可能错位。验收必须包括代表性位置的视觉/坐标检查。
7. **`.sdb` 边界**：V0 只诊断不显示完整离线航拍；若用户把“所有 `.ovmap` 都能导入”解释为“任何配套离线影像立即可见”，需要正式扩围。
8. **磁盘动态变化**：同日从极低空间恢复到约 25 GiB。每个安装/构建阶段前都要实时复核，不能依赖旧读数。
9. **商标/兼容表述**：必须说“兼容导入”而不是冒充奥维官方或复制品牌。
10. **本机监听暴露**：官方客户端文档只说明端口，没有证明可绑定回环。若实际监听 `0.0.0.0`，不得启用，真实桥接保持 blocked。
11. **日期语义**：官方 Web 接口的目标日期可能返回“该日前最近一景”，但不返回拍摄日期。UI 必须允许 `captureDate=null`。
12. **截图配准**：用户红框是产品范围证据，不是地理坐标证据；必须经地图编辑确认。
13. **环境因果**：水色、云、季节和传感器差异可能看似污染；没有外部数据不得下确定结论。

## 15. 上下文覆盖账本

| 来源层 | 目标 | 已查 | 证据 | 可信度 | 未查/原因 |
|---|---|---|---|---|---|
| 用户意图 | 目标、终端、V0 | 当前线程全部相关消息 | 用户原话与批准 | 高 | 真实 QR 样本未提供 |
| 官方产品 | QR、`.ovmap`、字段、`.sdb` | 决定性帮助页 | 第 3 节链接 | 高 | 私有二进制 schema 未公开 |
| GitHub | 奥维相关仓库/样本 | 多查询族、代码搜索和重点仓库静态核验 | 第 9 节 | 中 | 私有/删除/未索引仓库不可见 |
| 本地资产 | 是否已有项目 | 工作区深度 2 目录/关键文件 | find 输出 | 高 | 深层无关项目未扫描，因绿地命名已足够 |
| 二进制样本 | `.ovmap` 基本容器 | 一个公开 455-byte 样本 | 魔数、zlib、字符串 | 中 | 字段边界、历史版本、加密未知 |
| 运行链 | Web UI 到真实出图 | 尚无产品 | missing | 高 | 需实施后验证 |
| 发布链 | GitHub/CI/部署 | 尚未建立 | missing | 高 | 未获当前远端写入/部署范围 |

继续检索的停止条件已满足到“可以写 V0 规格”，但不满足“可以声称完整兼容”。实施任务 0 要补依赖版本、合法 fixture 和运行命令。

## 16. 转入 `goal.md` 检查

- 用户、问题、V0 范围和非目标已进入。
- 二维码、`.ovmap`、多图层、`.sdb` 缺失和安全预览旅程已进入。
- 解析/探测/渲染/保存事实状态、凭证和授权规则已进入。
- Web UI＋本地网关、开放 schema 和后续跨平台边界已进入。
- 指标不使用虚构基线，假成功和秘密泄漏为硬门。
- AC 覆盖主流程、损坏/未知、部分成功、权限、安全、移动/桌面和重启恢复。

## 17. Leader 运行复盘与技能改进候选

`EV-CAND-001 | 2026-08-27 | 旧规格把多时相遥感放到后续，且把 QR 主要当单图源；用户纠正同一个历史二维码可选择多个年份 | 官方奥维 10.6.0 实际导入后识别 GEE 历史影像并出现时间轴 | 根因是未在真实官方客户端验证特殊协议就冻结了单图源主线 | 当前项目新增 JRN-007 至 JRN-010、FR-009 至 FR-013、AC-011 至 AC-016，并把日期目录建模为运行时事实 | 待真实日期/瓦片复验 | 单项目一次 | 暂不修改全局 Skill | 该领域特殊，不应泛化为所有二维码 | proposed`
