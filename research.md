# OpenMapBridge 现实、证据与工程研究总线

## 1. 任务与研究边界

### 用户裁决摘要

- 目标：开发开源、可二次开发的奥维同类地图平台。
- V0：扫描真实奥维图源二维码或导入 `.ovmap`，安全预览后真实出图并保存。
- 形态：全平台为长期方向；若原生拖慢，Web UI 可接受；重点是能实际拉起运行。
- 2026-08-27 用户已批准聊天中的 V0 方向，并明确回复“书面规格批准”；当前阶段为 `spec-approved / plan-ready`。
- 2026-08-27 用户提供并授权试用一张“奥维高清历史影像91”二维码；要求同一个图源选择多个历史年份，并批准“官方奥维本机桥接＋开放 Web 对比核心”。
- 首批业务验收：宝应湖、高邮湖用户框选区域 2006–2025 的对齐影像、四期对比和时间播放；污染、过度渔猎/养殖或开发原因只作为待验证假设。
- 2026-08-27 用户纠偏：产品不是双湖专用时间轴，而是任意图源上框选任意区域后一次自动得到四张、展现约 20 年变化；双湖只做实验。用户随后明确批准“方案 A”，即保留开放内核、先贯通官方奥维本机桥接真实源，再扩展协议矩阵和规模。
- 2026-08-28 用户再次纠偏：项目最核心应先打通奥维图源导入；二维码图片/摄像头扫描和 `.ovmap` 文件都必须真实实现。当前切片由消费端四期对比切回 `SLICE-V0-IMPORT-001`，既有时序能力保留为下游回归。
- 2026-08-28 用户明确最终结果必须“基于奥维地图图源进行二次开发”。这不是把插件市场整体提前，而是把脱敏、版本化、可协商能力的开发者 API/SDK 提升为核心产品契约；导入是图源获取上游，历史四期是代表性消费端。

### 本轮回答

- 固化产品旅程、规则、数据、接口、安全和验收。
- 记录当前 `.ovmap`/二维码证据、开源候选、项目资产和技术推荐。
- 当前增量以 `SLICE-V0-SDK-001` 用 TDD 冻结二次开发契约：能力描述、V1 本地 API、TypeScript SDK、严格应用清单和最小消费示例；不抓取大范围地图、不部署公网、不连接企业服务器，也不执行任意第三方插件代码。
- 2026-08-27 20:14 当前实现已完成合成源上的任意 AOI、四屏、卷帘、播放、缺年状态和观察证据等级；48 个 Vitest 加 2 个 Node 测试、类型检查、生产构建和 2 条 Chrome E2E 通过。该结论仍是 `local-verified` 合成消费链路，不代表 QR/`.ovmap` 已导入或真实奥维瓦片已经可用。

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
- 已完整读取：`product-specification.md`、`anatomy.md`、`context-acquisition.md`、`dual-translation.md`、`research-orchestration.md`、`evolution.md`
- reference SHA-256：
  - product-specification：`56d2f5d083c2d4074109fe3c9b9a04542a858d849754be5fdb1394d93cc70a40`
  - anatomy：`99492cea539426065460fa4c482d609460d09a4e3b87b5a4dcb0586bd9b52c08`
  - context-acquisition：`c4efe9db9b728e2ffe1f19d26d8c6f6005b3f1650afbfe7b9bc079a5587d6608`
  - dual-translation：`4dd5898ddbaed2450eccde27954db2a2c483fa53c7fa0db53bfa7eadc8220915`
  - research-orchestration：`3a91ff4564f695c87c333151b573f0747b4f48d23ec981bd416cf30224cbdf09`
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
- 先把二维码图片/摄像头与 `.ovmap` 两种入口汇入同一开放模型；用户保存后，再进入任意矩形/多边形框选和四期历史影像消费链路。

## 5. 业务对象与口径

| 对象 | 当前事实 | 状态/口径 | 来源 |
|---|---|---|---|
| QRInput | 图片/摄像头中的编码载荷 | 输入，不等于合法图源或可用地图 | 用户文件/摄像头 |
| OVMapFile | 奥维自定义地图配置容器 | 可能单图层/多图层；在线配置通常不含瓦片 | 用户文件 |
| MapSourceDefinition | 目标开放内部模型 | v1 local-verified；QR/ovmap 共用 | 平台解析/用户修正 |
| CredentialRef | token 等秘密引用 | 明文不得进入普通模型/日志 | 用户本地输入 |
| ImportReceipt | 脱敏事实账本 | confirmed 批次已实现；探测/渲染字段待后续 | 平台生成 |
| ProbeResult | 最小网络探测结果 | HTTP 成功不等于渲染成功 | 本地网关 |
| SDB companion | 奥维离线地图数据 | V0 只识别依赖，完整导入 planned | 用户文件 |
| FourFramePolicy | 动态 20 年窗口与四期选择 | local-verified；不得复制日期补齐 | 平台纯函数 |

## 6. 资产与环境地图

### 本地

| 资产 | 状态 | 证据 | 最后核验 |
|---|---|---|---|
| 项目目录 | 新建 `/Users/assis/Documents/Codex/2026-08-27/open-map-bridge` | 本轮文件系统创建 | 2026-08-27 |
| 既有同类本地仓库 | 未发现 | `find /Users/assis/Documents/Codex -maxdepth 2` 仅命中既有 VegFlow mapping 目录，无 Ovi/OpenMapBridge 项目 | 2026-08-27 |
| Git 仓库 | 隔离工作树分支 `feature/temporal-lakes-v0`，当前基线 `13d4162`；无 remote | `git branch --show-current`、`git log -1 --oneline`、`git remote -v` | 2026-08-28 |
| 根卷空间 | 2026-08-28 开工复核约 15 GiB 可用；此前曾剧烈波动，当前执行门为 8 GiB | `df -h /` | 2026-08-28 |
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

- 当前机器 GitHub CLI 在此前同线程核验为已登录账号 `LegalInvest`；当前隔离工作树无 remote、主仓或 CI。
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
- 2026-08-28 Chrome 对用户授权真实二维码完成图片解码和本地检查，证明它属于另一真实变体：结构键含 `at/ad/al`，`ul` 是 72 字符、不以 `/` 或 HTTP 开头且不含 XYZ 变量的不透明协议值。未输出任何字段值；实现丢弃 `at/ad/al` 和不透明 `ul`，只保留 `needs-credential/needsOviBridge` 事实。
- 星图云官方二维码场景需要用户导入后替换自己的 token，证明二维码可能只含模板或占位凭证。
- 图片上传已由用户真实二维码 E2E 验证；摄像头成功/取消/卸载停止轨道由组件代码和单元测试验证，硬件权限旅程尚未人工签收。无摄像头可切回图片上传。

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
| DEC-008 | 20 年口径 | 滚动 20 年 / 2006–2025 / 2000–2025 | 用户批准最近 20 个完整 UTC 自然年；2026 年运行时为 2006–2025 | 年界由纯函数和网关默认窗口测试保护 |
| DEC-009 | 双湖边界 | 直接像素转经纬度 / approximate 预设后用户确认 | 选后者；截图无空间参考，不冒充精确边界 | 首次多一步确认，但避免错区验收 |
| DEC-010 | 环境结论 | 影像自动判定污染 / 影像观察＋外部证据门 | 选证据门 | 结论更慢，但避免把季节、水色、传感器差异写成污染因果 |
| DEC-011 | 产品入口 | 固定双湖 / 任意框选区域 | 用户明确纠偏并批准任意框选；双湖为样例 | 需要 AOI 创建和几何自适应，但系统真正通用 |
| DEC-012 | 默认输出 | 全时间轴 / 一次四张跨 20 年 | 用户明确要求一次四张；采用最近 20 个完整自然年和四个等距锚点 | 长序列播放退为次要，不阻塞主结果 |
| DEC-013 | 实现主线 | 合并腾讯云 satmap / 开放适配器优先 / 直接逆向私有 GEE | 用户批准开放适配器优先；腾讯云应用只作后续消费端 | 最快形成真实合法闭环并降低私有协议耦合 |
| DEC-014 | 二次开发边界 | 直接暴露内部定义 / 脱敏能力 API＋SDK / V0 插件市场与任意代码执行 | 用户要求最终基于奥维图源二次开发；选脱敏能力 API＋SDK，导入源只有经真实绑定后才获得日期/瓦片能力 | 多一层契约，但避免插件耦合私有格式、泄露凭证或把未就绪源写成可用 |

## 11. 推荐系统与代码地图（当前实施状态）

目标目录边界：

```text
apps/web                 响应式地图与导入 UI
apps/gateway             本地 API、凭证、策略、瓦片代理、持久化
packages/source-schema   MapSourceDefinition、状态机、错误码
packages/developer-sdk   脱敏源描述、能力/权限、应用清单、V1 客户端
docs/技术交底书.md        技术问题、方案、特征候选、实施例、边界和追加式时间戳
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

二次开发增量数据流：

```text
confirmed import sources ─┐
                          ├→ whitelist descriptor → /api/v1/developer → SDK → industry app
runtime temporal registry ┘                       capability gate
```

静态检查确认现有 `/api/import/sources` 会返回完整内部 `MapSourceDefinition`，包括 hosts、pathTemplate、queryParameters、credentialRef、provenance 和 compatibilityExtension，不能直接作为开发者 API。现有 `/api/temporal/*` 只覆盖运行时 registry，且 confirmed 导入源不会自动绑定同 ID 适配器。当前切片必须新增白名单描述并诚实区分 `metadata-only` 与 `ready`；后续 IMPORT-002 再负责同一 source ID 的真实绑定。

上述导入路径中的开放 schema、显式状态机、QR 图片/摄像头、`ovobj` 两种真实结构、`.ovmap record37-zlib`、零上游预览、授权确认、原子 JSON 保存、回执和刷新恢复已实现；安全网络策略、凭证保险库、最小探测、瓦片代理和真实渲染仍缺失。时序路径中的日期事实、AOI 创建/版本、动态 20 年窗口、自动唯一四期、几何自适应、四屏、卷帘、播放和观察面板也已实现；真实奥维瓦片仍被第三方接口监听确认门阻塞。当前没有 CI、远端制品、公网部署或用户独立签收。

历史影像增量目标路径：

```text
packages/temporal-source     日期事实、适配器、帧回执
packages/aois                GeoJSON 验证、版本和双湖预设
apps/gateway/src/temporal    OviBridge、合成 fixture、受控日期瓦片路由
apps/gateway/src/aois        AOI 版本和比较持久化
apps/web/src/history         任意区域工作台、日期目录、四期选择、播放与观察
apps/web/src/map             共享 ViewState、四屏和卷帘
fixtures/synthetic/temporal  无外网的 20 年彩色/带标签时序瓦片
```

这些路径已经形成通用时序 `local-candidate`；真实源、QR/`.ovmap` 导入与用户独立签收必须分开晋级，不得因合成 E2E 写成业务已接受。

## 12. 已核验基线

| 层 | 事实 | 阶段 | 证据 |
|---|---|---|---|
| 产品裁决 | V0 方向和书面规格均获用户明确批准 | spec-approved | 当前线程 |
| 书面规格与实施计划 | `goal.md`、`research.md`、设计文档和 10 项实施计划已落盘；当前切片已重新排序为导入优先 | spec-approved / implementing | 本地文件、Git commit 与用户回复 |
| 实施计划 | `docs/superpowers/plans/2026-08-27-open-map-bridge-v0-import.md`，10 个任务、81 个步骤 | executing；导入切片完成，网络/渲染切片待续 | 本地计划、代码与验收记录 |
| 现有产品 | Web＋本地网关已有一键运行入口 | local-candidate | `npm run dev`；仅回环监听 |
| `.ovmap` 解析/UI | 公开 455-byte 样本经 codec 与 Chrome 均列出 5 图层；无上游请求 | AC-002 local-verified | compatibility test + authorized-local E2E |
| 二维码协议 | 普通模板结构和 `at/ad/al + opaque ul` 真实变体进入版本化 adapter | parser local-verified | 单元测试、用户真实 QR Chrome E2E |
| 用户历史二维码 | 官方客户端已导入并出现时间轴；开放 Web 已形成安全预览但未保存私有值或出图 | real-preview local-verified / render blocked | 官方客户端可见行为 + authorized-local E2E |
| 双湖 AOI | 用户提供含两块红框的参考图 | discovered / approximate | 当前附件；无空间参考，尚未形成确认 GeoJSON |
| Ovi Web 桥接 | 官方文档证明接口形态；本地适配器已验证只接受回环 origin、年度请求日期和 5 MiB 上限；本机官方服务尚未启用和请求 | adapter local-verified / real compatibility-gate blocked | `apps/gateway/src/temporal/ovi-bridge.ts` 与 6 个相关测试；需验证官方监听和特殊历史源出图 |
| 时序 Web UI | 四屏、卷帘、播放、AOI 编辑和观察面板已实现 | local-candidate | Chrome E2E 通过；真实源未过门 |
| 导入 Web UI | 默认首页提供二维码图片、摄像头和 `.ovmap` 点击/拖入，预览后授权保存 | local-verified slice | 4 默认 E2E + 2 授权本地 E2E |
| 二次开发 V1 | 脱敏源目录、能力协商、严格应用清单、TypeScript SDK 和本地日期/瓦片消费已实现；configured OviBridge 不授予运行能力 | local-verified slice | `packages/developer-sdk`、`apps/gateway/src/{developer,routes/developer}.ts`、8 项聚焦测试和实际 HTTP |
| 技术交底持续同步 | 中文技术交底书覆盖架构、流程、数据、安全、特征候选、实施例和当前证据边界；122 个核心文件生成 SHA-256，CI 检查陈旧 | local-verified mechanism | `docs/技术交底书.md`、`scripts/update-technical-disclosure.mjs`、`npm run disclosure:check`；2026-08-28 |
| 工作区基线 | 隔离分支；Node 26.7.0、npm 11.19.0、244 packages、0 vulnerabilities；8 GiB 磁盘门 | local-verified | `npm run env:check` 与 lockfile；2026-08-28 |
| 自动测试 | 92 Vitest + 2 Node、8 workspace 类型检查、生产构建、4 默认 Chrome E2E 和 2 授权本地 E2E 均通过 | local-verified | 完整命令链；2026-08-28 |
| GitHub main | 公共唯一主仓 `LegalInvest/open-map-bridge`；产品代码提交 `4b90939` 已进入 main，GitHub CI run `33146192919` 全绿 | main for recorded commit | GitHub repo、Actions run；2026-08-28 |
| 部署 | 无 | missing | 未授权/未实施 |
| 业务验收 | 真实 QR 安全预览和真实 `.ovmap` 五图层已过；真实 QR 瓦片渲染与用户独立签收未过 | import slice local-verified / AC-001 partial / accepted missing | `docs/acceptance/import-v0-local.md` |

## 13. 规格—代码—发布追踪矩阵

| ID | 产品目标/行为 | 当前现实 | 目标路径/接口 | 测试/E2E | 阶段 | 差距/阻塞 | 最后核验 |
|---|---|---|---|---|---|---|---|
| JRN-001 / FR-001 | 真实二维码到出图 | 用户 QR 已在 Chrome 解码成脱敏预览；合成 QR 已授权保存/刷新 | `apps/web/src/import`、`packages/qr-import` | AC-001 partial | preview local-verified / render blocked | 私有值未入 vault；未探测/出图 | 2026-08-28 |
| JRN-002 / FR-002 | 多图层 `.ovmap` | 公开真实 5 图层样本经 codec 与 UI 通过 | `packages/ovmap-codec`、IF-001 | AC-002/003 | local-verified family | 只覆盖 `record37-zlib`；其他家族 unsupported | 2026-08-28 |
| FR-003 / DATA-001 | 统一开放模型 | schema v1、Zod 约束和显式状态机已实现 | `packages/source-schema` | schema/state tests | local-verified | 未来版本迁移尚无 v2 fixture | 2026-08-28 |
| FR-004 / BR-004/005 | 安全预览、零外联、秘密 | 检查零上游、秘密剥离、授权前后端门已实现 | `apps/gateway/src/import`、`apps/web/src/import` | unit/route/E2E | partial local-verified | URL/IP SSRF 策略与 vault 未实现 | 2026-08-28 |
| FR-005 / IF-003 | 代理和真实渲染 | 仅推荐架构 | `apps/gateway`、`apps/web` | AC-005/007 | planned | 缺协议、CORS、SSRF和真实源 E2E | 2026-08-27 |
| FR-006 / DATA-002 | 保存、回执和重启恢复 | confirmed 定义/回执原子 JSON 保存，重开仓库和刷新恢复 | gateway persistence | AC-006 partial | local-verified for confirmed | 凭证、删除/撤销和生产迁移未实现 | 2026-08-28 |
| FR-007 | 部分成功和诊断 | 稳定解析错误和 confirmed 回执已实现 | UI-004、receipt service | AC-003/008/009 | partial local-verified | 缺逐层探测、重试、撤销 | 2026-08-28 |
| FR-008 / IF-004 | 开放导出 | 仅规格 | source-schema export | AC-010 | planned | 缺开放 schema 文档与 QR 容量策略 | 2026-08-27 |
| NFR-001 | SSRF/解压/开放代理防护 | 解压/记录边界反例已实现；尚无网络动作 | security/gateway | 恶意反例套件 | parser local-verified / network planned | 缺 URL 与解析后 IP 策略 | 2026-08-28 |
| NFR-007 | 合法开源依赖 | 候选已发现 | lockfiles、THIRD_PARTY | license audit | discovered | 版本/许可证/安全公告待任务0复核 | 2026-08-27 |
| AC-001 至 AC-010 | 业务验收 | AC-002/003 本地通过；AC-001 完成真实预览但未出图；其余部分/未运行 | E2E + 真实浏览器 | 对应 AC | mixed, no cross-level rollup | 下一门为 vault/SSRF/probe/render | 2026-08-28 |
| JRN-007 / FR-009 | 历史源日期和真实瓦片 | 日期事实、合成 20 年源、安全 OviBridge、注册源瓦片 API 已本地验证；官方客户端仅导入成功 | `packages/temporal-source`、`apps/gateway/src/{temporal,routes/temporal}.ts` | gateway/contract suite 22 tests；AC-011 未运行 | synthetic local-verified / real adapter blocked | 官方日期目录仍下载；Web 服务未启用 | 2026-08-27 |
| JRN-008 / FR-010 | 双湖 AOI 确认 | GeoJSON 校验、独立 approximate 预设、地图新建/编辑和不可变版本追加已本地验证 | `packages/aois`、`apps/web/src/history/Aoi*` | unit + Chrome E2E | synthetic UI local-verified | 预设不是用户在真实影像上确认的精确边界 | 2026-08-28 |
| JRN-009 / FR-011/012 | 四屏、卷帘和播放 | 四屏、逐屏状态、共享/回放 ViewState、卷帘、播放和缺年隔离均已本地构建 | `apps/web/src/history` | UI/sync tests + Chrome E2E passed | synthetic local-verified | 真实奥维源和用户 AOI 未接受 | 2026-08-27 |
| FR-013 / BR-014 | 变化观察证据等级 | 可见对象、原因假设和独立证据门已实现 | `apps/web/src/history/ObservationPanel.tsx` | component tests passed；AC-016 synthetic-only | UI local-verified | 尚无真实观察、外部逐年证据或用户接受 | 2026-08-27 |
| JRN-007/008 / FR-010/014 | 任意框选后自动四期 | POST 创建、服务端 `area-*` 身份、矩形拖拽/多边形绘制、动态 20 年窗口、唯一四期、几何 fit 和真实浏览器非湖区旅程均已实现 | `packages/aois`、`packages/temporal-source`、`apps/gateway/src/routes/aois.ts`、`apps/web/src/history` | 单元/组件/路由测试 + 非湖区 Chrome E2E | synthetic local-verified / generic UI local-candidate | 真实奥维四日期闸门与用户独立签收未完成 | 2026-08-27 20:09 |
| JRN-011 / FR-015/016 / IF-007 | 基于导入图源二次开发 | 白名单描述合并 imported sources 与 runtime registry；SDK 校验清单/权限/能力并只构造 V1 本地路径 | `packages/developer-sdk`、`apps/gateway/src/developer`、`apps/gateway/src/routes/developer.ts` | 8 个契约/路由反例、全量测试/类型/构建、实际 HTTP | local-verified slice | 真实 imported source 仍 metadata-only；缺同 ID vault/probe/runtime binding | 2026-08-28 |

阶段计数不能跨级汇总：`SLICE-V0-IMPORT-001`、`SLICE-V0-SDK-001` 和合成时序链路分别达到 `local-verified`；真实二维码渲染、完整 AC-001/011、`main`、`deployed` 和用户 `accepted` 均未达到。

## 14. 风险与未决项

1. **协议漂移**：`.ovmap` 可能跨版本改变头部、压缩、字段和记录布局。对策是显式适配器和 golden fixture，不做无边界扫描。
2. **二维码私有协议**：官方未公开 wire schema。用户样本证明至少存在普通模板与 `at/ad/al + opaque ul` 两种变体；未知字段继续失败关闭，私有值必须进 vault 或官方桥而非普通 JSON。
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
14. **“奥维全部能力”表述**：奥维本体为专有产品，公开候选许可证与功能覆盖不完整。当前只能建立 clean-room 兼容矩阵，逐协议、逐合法样本晋级，不能把“找到仓库”写成全兼容。

## 15. 上下文覆盖账本

| 来源层 | 目标 | 已查 | 证据 | 可信度 | 未查/原因 |
|---|---|---|---|---|---|
| 用户意图 | 目标、终端、V0 | 当前线程全部相关消息 | 用户原话与批准 | 高 | 用户 QR 图片已提供；载荷不得落库或输出 |
| 官方产品 | QR、`.ovmap`、字段、`.sdb` | 决定性帮助页 | 第 3 节链接 | 高 | 私有二进制 schema 未公开 |
| GitHub | 奥维相关仓库/样本 | 多查询族、代码搜索和重点仓库静态核验 | 第 9 节 | 中 | 私有/删除/未索引仓库不可见 |
| 本地资产 | 是否已有项目 | 工作区深度 2 目录/关键文件 | find 输出 | 高 | 深层无关项目未扫描，因绿地命名已足够 |
| 二进制样本 | `.ovmap` 基本容器 | 一个公开 455-byte 样本 | 魔数、zlib、字符串 | 中 | 字段边界、历史版本、加密未知 |
| 运行链 | Web UI 到真实出图 | 双入口解析/确认保存与合成时序消费链均验证 | 全量测试和 6 条 Chrome E2E | 高 | 中间的 vault/SSRF/probe/真实 tile proxy 尚缺 |
| 发布链 | GitHub/CI/部署 | 公共 GitHub main 与 push/PR CI 已建立；公网应用部署仍未建立 | main verified / deployment missing | 高 | `4b90939`、CI run `33146192919`；无部署制品或环境 |

继续检索的停止条件已满足到“可以写 V0 规格”，但不满足“可以声称完整兼容”。实施任务 0 要补依赖版本、合法 fixture 和运行命令。

## 16. 转入 `goal.md` 检查

- 用户、问题、V0 范围和非目标已进入。
- 二维码、`.ovmap`、多图层、`.sdb` 缺失和安全预览旅程已进入。
- 解析/探测/渲染/保存事实状态、凭证和授权规则已进入。
- Web UI＋本地网关、开放 schema 和后续跨平台边界已进入。
- 指标不使用虚构基线，假成功和秘密泄漏为硬门。
- AC 覆盖主流程、损坏/未知、部分成功、权限、安全、移动/桌面和重启恢复。
- 二次开发直接角色、能力最小授权、私有字段白名单、V1 SDK/接口和 AC-017/018 已进入；插件市场与任意代码执行明确留在后续。

## 17. Leader 运行复盘与技能改进候选

`EV-CAND-001 | 2026-08-27 | 旧规格把多时相遥感放到后续，且把 QR 主要当单图源；用户纠正同一个历史二维码可选择多个年份 | 官方奥维 10.6.0 实际导入后识别 GEE 历史影像并出现时间轴 | 根因是未在真实官方客户端验证特殊协议就冻结了单图源主线 | 当前项目新增 JRN-007 至 JRN-010、FR-009 至 FR-013、AC-011 至 AC-016，并把日期目录建模为运行时事实 | 待真实日期/瓦片复验 | 单项目一次 | 暂不修改全局 Skill | 该领域特殊，不应泛化为所有二维码 | proposed`

`EV-CAND-002 | 2026-08-27 | 旧历史影像规格和 UI 把双湖写成产品主体，用户再次纠正“最终是通用系统”，随后收敛为任意区域一次四张跨 20 年 | goal.md、HistoryWorkspace、gateway 默认值和 E2E 均存在 lake/2006–2025 硬编码 | 根因是把首批验收夹具反向写成产品入口 | 当前项目批准通用框选四期设计，双湖降为 fixtures，新增 POST AOI、动态窗口、唯一四期和非湖区 E2E 计划 | 待实现复验 | 同项目第二次用户纠偏 | 暂不修改全局 Skill；Leader 已有“验收样例不得反向定义产品”原则 | 泛化规则已存在，先修项目执行 | proposed`

`EV-CAND-003 | 2026-08-28 | 消费端四期对比已经形成完整合成链路，但产品入口仍不能读取用户最关键的二维码和 .ovmap；用户第三次纠偏把导入提升为核心 | 当前仓库只有 aois/temporal-source，packages/source-schema、qr-import、ovmap-codec 和导入 UI 均不存在 | 根因是优先交付了可见的历史影像界面，却跨过了上游图源获取与事实晋级门 | goal.md 切换为 V0.4，当前实施顺序改为 schema→双 codec→零外联预览→授权保存→后续真实渲染 | 待本轮代码和浏览器复验 | 同项目第三次用户纠偏 | 暂不修改全局 Skill；把纠偏作为项目执行审计项 | 若再次先做消费端，应触发停止并回到入口闭环 | proposed`

`EV-CAND-004 | 2026-08-28 | 规格虽多次写“开放、可扩展”，但仍把插件 SDK 放在后续；用户明确最终必须基于奥维图源二次开发 | goal.md 旧角色表和后续范围与用户最终产品定义冲突，内部 import API 还会暴露 hosts/path/credentialRef | 根因是把架构可扩展性误当成开发者可完成旅程 | goal.md 升级 V0.5，新增 JRN-011/能力和秘密契约，并实现白名单 V1 API/SDK；真实源能力仍独立受探测门控制 | AC-017/018 本地复验通过 | 同项目第四次产品纠偏 | 暂不修改全局 Skill；现有 Skill 已要求 API 平台 onboarding/权限/版本旅程 | 泛化原则已存在，先修项目 | verified`
