# OpenMapBridge 双湖历史影像 V0 设计

## 状态

- 类型：OpenMapBridge 的历史影像增量设计
- 状态：Approved / Implementing
- 用户裁决：2026-08-27 用户批准“奥维兼容桥接＋开源 Web 对比核心”，并把宝应湖、高邮湖过去 20 年影像设为首批验收目标
- 产品真值：项目根目录 `goal.md`
- 现实与证据：项目根目录 `research.md`
- 依赖设计：`docs/superpowers/specs/2026-08-27-open-map-bridge-v0-design.md`

## 1. 用户结果

首位验收者从本机 Web 页面选择“宝应湖”或“高邮湖”，取得 2006–2025 的真实历史影像时间序列，在同一 AOI、投影、中心、分辨率和旋转下进行 1/2/4 屏对比、卷帘和播放，并能区分：

- 请求日期；
- 源站返回的真实拍摄日期（若接口能提供）；
- 影像已加载、部分加载、无数据、源站错误和日期未知；
- 直接可见变化与需要外部证据验证的污染、养殖或开发原因。

V0 不承诺一定发现污染或过度渔猎。没有显著变化也是有效结果；系统不得为了满足预期增强、替换或虚构变化。

## 2. 时间和区域口径

### 时间

- “过去 20 年”在首批验收中固定为 2006-01-01 至 2025-12-31，共 20 个完整自然年。
- 图源提供不规则日期时保留原日期目录；每年默认选择最接近该年生长季中点且云量/可用性最优的可用影像，选择算法及理由进入帧回执。
- 若奥维桥接接口只支持“目标日前最近一景”，而不能返回真实拍摄日期，UI 必须显示“请求日期 YYYY-MM-DD；实际拍摄日期未知”，不得把请求日期冒充拍摄日期。
- 缺年保持缺口；V0 不做时间插值。

### 区域

- AOI-BAOYING：宝应湖，来源为用户 2026-08-27 上传截图中的北部红色框选区。
- AOI-GAOYOU：高邮湖，来源为同一截图中的南部红色框选区。
- 截图没有空间参考，首版预设只能标为 `approximate`。用户在真实地图上编辑并确认后生成版本化 GeoJSON，状态才进入 `confirmed`。
- 所有对比和导出使用同一确认后的 AOI 版本；AOI 变化会生成新版本并使旧对比回执保持可追溯。

## 3. 选择的架构

```text
用户持有的奥维历史影像二维码
          │ 官方客户端合法导入
          ▼
奥维桌面客户端 10.6.0
          │ 官方 Web 瓦片接口，按日期请求
          │ 仅允许本机回环访问
          ▼
OviBridgeAdapter ───────┐
                       │
StandardTemporalAdapter├─ TemporalSourceAdapter
(XYZ/WMTS/WMS/STAC/COG) │  listDates / getTile / probe
                       ▼
本地 OpenMapBridge Gateway
  ├─ 日期目录与请求日期/拍摄日期事实
  ├─ AOI 版本、帧回执、错误与小型缓存
  └─ 已注册源专用瓦片路由
                       ▼
OpenLayers Web UI
  ├─ 1/2/4 屏共享 ViewState
  ├─ 每屏独立日期
  ├─ 双屏卷帘
  ├─ AOI 编辑/确认
  ├─ 时间轴播放
  └─ 后续 MP4/GIF 导出
```

奥维兼容只存在于 `OviBridgeAdapter`。地图 UI、AOI、时间目录、帧回执和后续变化算法只依赖开放接口，避免把产品绑定到私有协议。

## 4. 兼容性闸门

在开发真实源链路前必须完成以下只针对本机的最小实验：

1. 确认奥维官方 Web 瓦片服务可以绑定回环地址；若只能监听所有网卡，不启用，记录阻塞。
2. 对已导入的历史图源 ID 发出一个日期、一个坐标、一个瓦片请求。
3. 证明两个不同年份得到可解码影像，或如实证明源站/客户端没有返回。
4. 记录 HTTP 类别、图片尺寸和哈希，不保存或提交真实瓦片、主机、token、二维码载荷。
5. 若接口不能列出真实日期，日期目录能力保持不支持/未知，不得自动生成年度请求目录。操作者明确选择的少量探测日期只是 probe 输入，不能作为源日期目录或宣称真实年份可用。

该闸门失败不阻止用本地合成时序瓦片完成四屏 UI；但真实双湖验收保持 `blocked`，不得用合成图晋级。

## 5. 开放接口

```ts
export type DatePrecision = 'capture-date' | 'request-date-only';

export interface TemporalDateEntry {
  id: string;
  requestDate: string;
  captureDate: string | null;
  precision: DatePrecision;
  availability: 'available' | 'missing' | 'unknown' | 'failed';
  provenance: string;
}

export interface TemporalSourceAdapter {
  probe(): Promise<TemporalProbeResult>;
  listDates(input: { aoiId: string; from: string; to: string }): Promise<TemporalDateEntry[]>;
  tileUrl(input: { dateId: string; z: number; x: number; y: number }): string;
}

export interface AreaOfInterest {
  id: 'baoying-lake' | 'gaoyou-lake' | string;
  version: number;
  name: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  crs: 'EPSG:4326';
  status: 'approximate' | 'confirmed';
  provenance: string;
  confirmedAt: string | null;
}

export interface ComparisonFrameReceipt {
  dateId: string;
  status: 'loaded' | 'partial' | 'missing' | 'failed';
  expectedTileCount: number;
  loadedTileCount: number;
  failedTileCount: number;
}

export interface ComparisonReceipt {
  schemaVersion: 1;
  id: string;
  sourceId: string;
  aoiId: string;
  aoiVersion: number;
  dateIds: [string, string, string, string];
  viewState: { center: [number, number]; zoom: number; rotation: number; projection: string };
  frames: [ComparisonFrameReceipt, ComparisonFrameReceipt, ComparisonFrameReceipt, ComparisonFrameReceipt];
  createdAt: string;
}
```

## 6. API

- `GET /api/temporal/sources`：返回已注册时序源及真实阶段，不返回上游秘密。
- `POST /api/temporal/sources/:id/probe`：只探测一个固定瓦片，生成脱敏回执。
- `GET /api/temporal/sources/:id/dates?aoiId=&from=&to=`：返回日期目录和精度。
- `GET /api/temporal/tiles/:sourceId/:dateId/:z/:x/:y`：只允许已注册源和已知日期 ID；不接受任意 URL/host/token。
- `GET /api/aois`：返回 AOI 版本和确认状态。
- `PUT /api/aois/:id`：保存用户编辑后的 GeoJSON，新建版本，不覆盖旧版本。
- `GET /api/comparisons`：回访已持久化的严格比较回执。
- `POST /api/comparisons`：原子冻结 ready source、confirmed AOI 精确版本、四个互异日期、共享 ViewState 和四屏全部结算的 expected/loaded/failed 事实；ID/时间由服务端生成。

2026-09-01 实现裁决：首版采用一次性终态 POST，不开放可伪造或未结算的逐帧事件追加接口。后续若需要流式事件，必须先有幂等序号、归属和封口协议。

## 7. Web 页面

### 历史影像工作台

顶部：区域选择、时间范围、图源状态、日期精度和“播放变化”。

左侧：

- 宝应湖/高邮湖 AOI；
- `approximate` 或 `confirmed` 标签；
- 编辑、撤销本次编辑、确认范围；
- 日期目录，缺失和错误必须可见。

主画布：

- 默认四屏；可切换单屏、双屏、四屏和双屏卷帘；
- 四个 OpenLayers Map 共享一个可序列化 `ViewState`，事件使用来源标记防循环；
- 每屏独立选择日期，显示请求日期、实际拍摄日期/未知、来源和加载计数；
- 一屏失败不遮盖其他三屏，也不把全局状态写为成功。

底部时间轴：按真实日期排序；播放只切换已选择/可用条目，支持暂停、前后帧和速度。播放不是视频导出成功的替代证据。

### 变化观察面板

只记录可复核观察：位置、起止日期、可见对象、方向、截图/帧回执。污染、养殖、过度开发等解释默认标为“假设”，需要水质、养殖范围、岸线/土地利用或政策数据支持后才能升级为“有外部证据支持”。

## 8. 对齐规则

1. 所有面板使用相同投影和像素尺寸。
2. 共享中心、缩放、旋转和容器布局；任一地图交互在下一动画帧同步到其他地图。
3. 比较冻结时保存精确 ViewState、AOI 版本和面板尺寸。
4. 同一地图实体以 AOI mask 裁切；mask 外区域降低透明度但可保留定位上下文。
5. 若不同年代影像存在正射误差，UI 标记“源影像可能存在配准差”，不通过前端拉伸制造伪对齐。

## 9. 安全与资源边界

- 奥维客户端、OpenMapBridge 网关和 Web UI 只在本机运行；不得公网暴露瓦片服务。
- 不解密或复现 GEE 私有认证；使用官方客户端已经授权的访问路径。
- 不提交二维码、认证材料、真实瓦片和源站细节。
- 预览/对比按视口请求；V0 不做两湖 20 年整域离线抓取。
- 瓦片缓存上限 256 MiB；根卷可用空间低于 5 GiB 停止安装/构建，低于 2 GiB 停止新增缓存。
- 每个面板并发上限和全局限流在实现前通过本地 fixture 测试冻结。

## 10. 测试与验收

### 自动测试

- 合成时序源证明 20 年目录、缺年、请求日期与拍摄日期分离。
- 四屏 ViewState 同步、解除同步和事件防循环。
- AOI GeoJSON 验证、版本追加和旧回执不漂移。
- 一屏 404/429/超时时其他屏保持独立事实。
- 任意 URL、未知 dateId、私网绕过和秘密回显全部失败。
- 时间轴播放不跳过失败事实，不把未加载帧记为已加载。

### 真实验收

- AC-TEMP-001：官方奥维导入该二维码后，OpenMapBridge 通过受控桥接取得至少两个不同历史日期的非空瓦片；若做不到，明确保留阻塞。
- AC-TEMP-002：宝应湖确认 AOI 在 2006–2025 目录中完成四期同步对比，至少一帧来自真实源。
- AC-TEMP-003：高邮湖确认 AOI 完成相同旅程。
- AC-TEMP-004：四屏平移、缩放、旋转后 ViewState 数值一致；一屏错误不被全局成功遮盖。
- AC-TEMP-005：时间轴播放完整遍历可用日期并可暂停/恢复；每帧有真实加载回执。
- AC-TEMP-006：任何污染、养殖或过度开发结论必须显示证据等级和外部证据缺口。

自动测试、页面打开和合成瓦片只能达到 `local-candidate`。双湖真实源旅程需要用户确认 AOI 并独立签收后才是 `accepted`。

## 11. 实施顺序

1. 更新产品真值、现实证据和独立实施计划。
2. 建立隔离工作区和最小 TypeScript/OpenLayers/Fastify 骨架。
3. 用合成时序瓦片 TDD 完成日期、AOI、四屏同步和加载回执。
4. 完成本机 OviBridge 兼容性闸门。
5. 接入宝应湖、高邮湖预设并由用户在地图上确认。
6. 完成真实日期选择、四屏/卷帘、播放。
7. 在真实旅程稳定后增加 MP4/GIF 导出；导出使用现有已加载/受控请求帧，不扩大抓取范围。

## 12. 回滚与退出

- OviBridge 是可拔插适配器；失败时仍保留标准时序源和合成验收环境。
- 任何网络设置更改先记录原值；停用 Web 瓦片服务即可撤销桥接，不删除奥维图源或用户数据。
- AOI 与比较回执追加版本，不原地覆盖；应用数据与真实奥维数据分离。
- 不修改旧导入规格的安全不变量；历史影像是增量能力，不降低导入链路门槛。
