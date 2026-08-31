# BLOCKED

## 当前阻塞

1. AC-011：真实二维码已由官方奥维成功导入，但日期目录/瓦片仍显示下载中；尚未证明特殊 GEE 历史源能通过官方 Web 瓦片接口按四个日期返回可解码、非空且互不相同的瓦片。
2. 安全监听：2026-08-27 当前官方客户端“第三方接口”为“不启用”，socket 检查未发现监听。启用属于网络监听变更，须在操作时确认；启用后只接受 `127.0.0.1`/`::1`，若为所有网卡则立即关闭。
3. AC-012/013 的湖区事实声明：用户截图没有空间参考。宝应湖和高邮湖红框只能作为 approximate 预设，必须由用户在真实地图上确认后才能用于精确湖区结论；这不再阻塞通用任意区域主旅程。
4. AC-001 的最终 `rendered+saved` 仍需要从用户授权真实二维码解析出的配置通过后续 URL/SSRF、凭证和最小探测门；本切片先完成真实图片解码、脱敏预览和确认保存，未探测时不得标记可用。
5. `.ovmap` 无公开完整线协议；首个 codec 只承诺经差分证据验证的 `record37-zlib` 家族，其他版本保持 `unsupported` 并等待合法样本，不能承诺“所有文件已全兼容”。
6. 用户真实历史二维码的 `at/ad/al` 和 72 字符不透明 `ul` 已安全识别但未保存；FIX-BATCH-012 的标准 query/header vault 不解释或重建这些奥维私有字段。必须继续通过官方奥维回环桥接或后续有合法格式证据的专用适配器，不得把不透明载荷手工塞入通用 vault、请求真实源或宣称出图。
7. 导入配置目前可保存为 `confirmed`；零外联静态策略已进入 main，FIX-BATCH-012 vault 核心曾在容量门满足时 local-verified、最终分支仍为 local-candidate，FIX-BATCH-011 已为固定回环 OviBridge 增加受控 probe/ready。通用图源请求时 DNS 解析后 IP、连接固定/重绑定、瓦片代理和投影修正仍未实现。静态策略、vault 或 Ovi 候选通过均不能证明其他网络源可用。
8. 开发者 V1 契约和合成适配器已贯通；真实 imported source UUID 现在可与 OviBridge 同 ID 绑定。FIX-BATCH-011 runtime source `94e42b1` 已进入 main 并部署到腾讯 current，只有显式 probe 瓦片通过完整图片门才赋予本次 runtime ready；该路径未对用户真实源执行，权威部署中的真实 imported source 仍必须保持 `metadata-only`。
9. 本机容量：2026-08-31 19:08 根卷可用约 7.15 GiB、swap 约 5.70 GiB，低于 8 GiB 执行门；本机构建、测试、浏览器、下载、影像和新腾讯制品部署已暂停。一条只输出 `df` 而未条件退出的组合命令曾在低容量读数后继续 build/smoke，该结果不算最终分支验证；`OMB-AUD-040` 自动前置门候选已写入，等待 GitHub CI。不得通过删除用户数据、项目证据或真实运行数据规避。
10. 全量审计：`docs/问题账本.md` 当前记录 40 组问题。FIX-BATCH-001–009 已进入 main，15 组达到 main、25 组仍未闭合；其余问题不得因生产制品与服务器候选就绪而标记解决。
11. 真实 ready 晋级：configured 隐藏、空 probe 失败、图片解码/内容验证、本地 gateway 入站信任边界、“不伪造日期目录”和 FIX-BATCH-011 的回环 probe/ready 编排均已进入 main；FIX-BATCH-012 vault 核心曾在容量门满足时 local-verified，但加入容量守卫后的最终分支为 local-candidate，尚未 main/deployed，也未在腾讯生成 master key。通用上游请求时 DNS/IP/连接固定/重绑定门、ProbeResult 持久化、真实日期目录 provider 和用户真实瓦片仍缺。`OMB-AUD-002` 保持部分开放，不能把 fixture/CI 晋级为真实源验收。
12. 三端部署：FIX-BATCH-011 runtime source `94e42b1` 的 PR/main CI `33379147631`/`33379302430`、部署证据 commit `a92ff8c` 的 main CI `33382682547` 全绿；腾讯 current `94e42b1` 的 artifact、项目 Node、systemd、宝塔 nginx include、双回环、health 和持久状态 hash 均通过。FIX-BATCH-012 尚未 main/deployed；保留 `62ab114` 与 `33f7f06` 作为已验证回退制品。真实 Ovi source 业务验收仍独立阻塞。
13. QR 方言：公开样本新增观察到 `hs/mf/ml/ms/mt/pn/pt`。FIX-BATCH-008 只接受这些键并丢弃未知值；其业务语义、授权和服务器可用性仍未知，不能由“解析成功”晋级为 ready。

## 已解除的实施阻塞

- Node 26、npm 11 和本机 Chrome 曾通过既有切片环境门；当时约 14 GiB 的空间证据是历史记录，不代表当前容量已解除。
- 精确依赖锁、31+ 测试、类型检查、生产构建和 Chrome E2E 已通过；没有下载浏览器或大体量地图。
- 未打包无许可证 `.ovmap`/二维码仓库，也未保存用户二维码和真实瓦片。
- 通用区域主旅程的实现阻塞已解除：`POST /api/aois`、地图框选/多边形创建、动态 20 年窗口、自动唯一四期、几何自适应和非湖区 E2E 均已本地通过。
- 二次开发契约阻塞已解除：严格应用清单、脱敏能力目录、SDK 日期/瓦片消费、非回环 base URL、开放代理查询和坐标边界反例均已本地通过。
- 同 ID configured 绑定阻塞已解除：`5a7e9ad` 只按显式 persisted source UUID 绑定 OviBridge，相同 legacyId 不串绑；configured 不进入时序消费，CI `33159198541` 通过。真实 probe/ready 仍在当前阻塞中。
- Ovi 响应安全阻塞已解除：`de36012` 对上游 body 流式限 5 MiB，只接受 200，隔离其他状态正文，并在返回前完整解码受限 PNG/JPEG；CI `33160315934` 通过。真实 probe、日期和 ready 仍在当前阻塞中。
- 本地 gateway 入站信任阻塞已解除：`1d0ebc4` 在业务路由前校验 Host/Origin/Fetch-Site/Bearer/CSRF/app 权限/限流，并保持 Vite 原始来源；CI `33161851375` 通过。上游 DNS/IP、vault、真实 probe/ready 仍在当前阻塞中。
- Ovi 日期伪造阻塞已解除：`5b6f06e` 删除年度请求目录生成器，无已验证目录明确失败，未登记与 `missing/failed` 日期 ID 零请求；CI `33163589956` 通过。真实目录提供者、probe/ready 和真实瓦片仍在当前阻塞中。

官方奥维 10.6.0 已安装到独立应用路径并保留导入结果；这不授权复制客户端、解密私有认证或输出真实 host/key。未知日期和字段继续保持 unknown。

## 越界候选

- `.sdb` 完整离线瓦片导入、企业服务器、对象系统、三维、CAD、插件市场/任意代码执行、自动污染因果判断和公网部署均不属于当前 SDK 薄切片。
- MP4/GIF 属于已批准后续切片，但必须等真实对比旅程稳定；不得为了导出批量抓取两湖 20 年整域瓦片。
