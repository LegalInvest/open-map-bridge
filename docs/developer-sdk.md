# OpenMapBridge V1 二次开发接口

本接口用于在不读取奥维二维码、`.ovmap` 私有字节、上游地址或凭证的前提下，消费用户已经确认导入的地图源。它是 clean-room 兼容平台接口，不是奥维官方 SDK。

## 当前能力边界

每个源独立声明能力：

- `metadata`：可读取脱敏名称、协议、投影、状态、版权和本地链接。
- `temporal-catalog`：可按 AOI 和日期窗口列出时序条目。
- `tiles`：可通过本地网关读取已知 source/date/z/x/y 的瓦片。

确认导入但尚未完成 SSRF 策略、凭证保险库、最小探测和运行时绑定的奥维兼容源只会得到 `metadata`，状态为 `metadata-only`。这表示“配置已确认”，不表示服务器可达或影像可用。当前 `synthetic-lakes` 是离线契约验收源；它不能替代真实奥维图源验收。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/developer/sources` | 列出脱敏源与真实能力 |
| GET | `/api/v1/developer/sources/:id` | 读取单个脱敏源 |
| GET | `/api/v1/developer/sources/:id/dates?aoiId=&from=&to=` | 仅有 `temporal-catalog` 时可用 |
| GET | `/api/v1/developer/sources/:id/tiles/:dateId/:z/:x/:y` | 仅有 `tiles` 时可用；禁止任何查询参数 |

响应不会出现 `hosts`、`pathTemplate`、`queryParameters`、`credentialRef`、`sourceProvenance`、`compatibilityExtension`、输入哈希或原始载荷。调用方不能提交 URL、host、token 或任意请求头。

## TypeScript SDK

应用必须先声明 API 版本、所需能力和只读权限：

```ts
import { OpenMapBridgeClient, parseDeveloperAppManifest } from '@omb/developer-sdk';

const manifest = parseDeveloperAppManifest({
  schemaVersion: 1,
  id: 'org.example.history',
  name: 'History application',
  apiVersion: 'v1',
  requiredCapabilities: ['metadata', 'temporal-catalog', 'tiles'],
  permissions: ['read-source-metadata', 'read-temporal-catalog', 'read-tiles'],
});

const client = new OpenMapBridgeClient({ baseUrl: 'http://127.0.0.1:4174', manifest });
const sources = await client.listSources();
const source = sources.find((entry) => entry.capabilities.includes('temporal-catalog'));

if (source) {
  const dates = await client.listDates(source, {
    aoiId: 'baoying-lake',
    from: '2006-01-01',
    to: '2025-12-31',
  });
  const tileUrl = client.tileUrl(source, { dateId: dates[0]!.id, z: 8, x: 212, y: 102 });
  console.log(tileUrl); // 只指向本地 /api/v1/developer 路径
}
```

完整可类型检查示例见 `packages/developer-sdk/examples/history-consumer.ts`。能力不足时 SDK 在执行 fetch 前抛出 `DeveloperSdkError`，`code` 为 `capability-not-available`；未知 API 版本、未知权限、非回环 base URL 和非法瓦片坐标同样 fail closed。

## 接入真实奥维图源的晋级门

1. 从二维码或 `.ovmap` 安全解析并确认，得到稳定 source ID。
2. 通过 URL/IP SSRF 策略和本地凭证保险库。
3. 以同一个 source ID 完成最小探测和运行时适配器绑定。
4. 只有真实日期目录和瓦片检查通过后，能力从 `metadata` 晋级为 `temporal-catalog`/`tiles`。
5. 行业应用继续使用相同 V1 SDK，不读取奥维私有格式。

V1 暂不提供插件市场、任意第三方代码执行、写图源、批量抓取或公网代理。
