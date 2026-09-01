# BLOCKED

## 当前阻塞

1. AC-011：真实二维码已由官方奥维成功导入，但日期目录/瓦片仍显示下载中；尚未证明特殊 GEE 历史源能通过官方 Web 瓦片接口按四个日期返回可解码、非空且互不相同的瓦片。
2. 安全监听：2026-08-27 当前官方客户端“第三方接口”为“不启用”，socket 检查未发现监听。启用属于网络监听变更，须在操作时确认；启用后只接受 `127.0.0.1`/`::1`，若为所有网卡则立即关闭。
3. AC-012/013 的湖区事实声明：用户截图没有空间参考。宝应湖和高邮湖红框只能作为 approximate 预设，必须由用户在真实地图上确认后才能用于精确湖区结论；这不再阻塞通用任意区域主旅程。
4. AC-001 的最终 `rendered+saved` 仍需要从用户授权真实二维码解析出的配置通过后续 URL/SSRF、凭证和最小探测门；本切片先完成真实图片解码、脱敏预览和确认保存，未探测时不得标记可用。
5. `.ovmap` 无公开完整线协议；首个 codec 只承诺经差分证据验证的 `record37-zlib` 家族，其他版本保持 `unsupported` 并等待合法样本，不能承诺“所有文件已全兼容”。
6. 用户真实历史二维码的 `at/ad/al` 和 72 字符不透明 `ul` 已安全识别但未保存；FIX-BATCH-012 的标准 query/header vault 不解释或重建这些奥维私有字段。必须继续通过官方奥维回环桥接或后续有合法格式证据的专用适配器，不得把不透明载荷手工塞入通用 vault、请求真实源或宣称出图。
7. 导入配置目前可保存为 `confirmed`；零外联静态策略、vault、Ovi ProbeResult、014B 请求计划、014C 通用最小 probe 与 014D 非时序 `map-tiles` 已包含在腾讯当前 `67a6a0e`。014D 要求同 UUID、同请求计划/凭据修订的 success 并逐请求复用固定传输和图片门；开放导出、temporal runtime、投影修正和真实源证明仍未实现，合成 probe/部署健康不能证明其他网络源可用。
8. 开发者 V1 契约和合成适配器已贯通；014D 新增独立 `map-tiles`，不伪造日期且凭据轮换会撤销旧能力。权威腾讯 `67a6a0e` 已含该代码，但官方 Ovi 和通用 probe 均未对用户真实源执行，故真实 imported source 仍是 `metadata-only`，不得写成 real-probed/rendered/accepted。
9. 本机容量：2026-09-01 07:49 根卷 `11,571,052 KiB`（约 11.04 GiB），高于 8 GiB 硬门；FIX-BATCH-016 既有 3 Node＋271 Vitest、8 typecheck、build/smoke、4 Chrome与 main CI 已通过，本轮精确 main build 也成功。每个后续重任务前仍须复核容量；不得通过删除用户数据、项目证据或真实运行数据规避。
10. 全量审计：`docs/问题账本.md` 当前记录 40 组问题。FIX-BATCH-001–009 与 FIX-BATCH-012 已进入 main，16 组达到 main、24 组仍未闭合；其余问题不得因生产制品与服务器候选就绪而标记解决。
11. 真实 ready 晋级：configured 隐藏、空 probe 失败、图片解码/内容验证、本地 gateway 入站信任边界、“不伪造日期目录”、回环 probe/ready、vault、固定传输、ProbeResult／输入指纹重启去重、014B 请求计划、014C 通用合成 probe 与 014D 非时序 tile runtime 均已进入 main/deployed-code。真实日期目录 provider、用户真实瓦片和第一条真实 ProbeResult 仍缺；官方客户端第三方接口的操作时开启与 loopback 监听验证需要用户确认。真实通用源、temporal runtime 和 QR/`.ovmap` 长尾字段仍阻塞。`OMB-AUD-002/007/008` 保持部分开放，不能把 fixture/CI/部署晋级为真实源验收。
12. 三端部署：本地/main/origin=`3cf763a`，PR 证据 CI=`33450368931`、main CI=`33450486867`；runtime source/Tencent current 最后可信=`67a6a0e`、runtime main CI=`33447839812`。精确 016 main gateway/Web hash=`fcc835ec…d0762`/`9f2aa734…ee90`，但尚未安装到腾讯。上轮腾讯项目 Node、systemd、宝塔 nginx include、双回环、health/vault、持久 state/vault hash 与服务器浏览器四屏 6/6 证据仍保留；本轮不能把未刷新状态写成实时通过。真实 Ovi 与真实通用 source 业务验收仍独立阻塞。
13. QR 方言：公开样本新增观察到 `hs/mf/ml/ms/mt/pn/pt`。FIX-BATCH-008 只接受这些键并丢弃未知值；其业务语义、授权和服务器可用性仍未知，不能由“解析成功”晋级为 ready。
14. 帧质量与回执：FIX-BATCH-015 已 main+deployed-code（`67a6a0e`），能区分 expected/loaded/failed、完整/partial/全失败。FIX-BATCH-016 严格 ComparisonReceipt 创建、持久化和刷新回访已进入 main `3cf763a`，但尚未 deployed；变更前生产 `comparisons=0`。ObservationPanel 保存、真实图源画布像素和用户确认回执仍缺，因此 OMB-AUD-015/016 保持 partial，任何合成回执、四屏或服务器 200 都不是真实 `rendered/accepted`。
15. 当前执行环境阻塞：2026-09-01 07:49 的 GitHub API 与腾讯 SSH 连接均被网络沙箱以 `Operation not permitted` 拒绝，本地回环监听也返回 `EPERM`。因此本轮只能完成精确构建、哈希与本地文档 checkpoint，不能安全发布或实时复核服务器；未发生远端修改。该限制不要求用户提供凭证或执行命令，下一次网络执行能力恢复后由 Codex续跑。
16. 2026-09-01 08:46 容量门再次触发：根卷可用 `7,657,624 KiB`（约 7.30 GiB），比 8 GiB 门少 `730,984 KiB`。已停止构建、测试、浏览器、下载、影像和部署；`lsof` 未显示项目服务/测试进程，系统 `ps` 与 swap 查询则被沙箱拒绝，故诊断仍标记为不完全。GitHub API 仍不可达，腾讯 SSH 仍为 `Operation not permitted`；腾讯 current/health 不能实时刷新，最后可信 `67a6a0e` 不冒充本轮验证。
17. 2026-09-01 09:46 根卷最低观测仅 `4,694,052 KiB`（约 4.48 GiB）。活动写入来自另一项目的 runner 下载：`curl` PID `8991` 持续扩大临时压缩包；本轮精确 `TERM` 被沙箱拒绝，未删除部分文件，也未触碰任何 data/db/source/rollout。由于该写入仍在进行且 GitHub/腾讯网络仍阻断，OpenMapBridge 只允许小型 checkpoint，不能推送、部署或运行任何重门。
18. 09:48 最终复核时 PID `8991` 与临时 runner 路径均已由所属流程自行结束/收口，活动下载阻塞解除；根卷仍只有 `4,850,260 KiB`（约 4.63 GiB），容量阻塞和 GitHub/腾讯网络阻塞继续存在。
19. 2026-09-01 10:00 用户明确暂不更新云服务器。因此 FIX-BATCH-016 未部署不再是当前 GitHub 交接阻塞，而是有意延期；腾讯 `67a6a0e` 仅是历史事实。当前真正阻塞是目标合并项目身份/能力未知、真实授权奥维源未完成 probe/render/accepted，以及本机低于 8 GiB不能重跑重门。

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
