# OpenMapBridge V1 二次开发接口

本接口用于在不读取奥维二维码、`.ovmap` 私有字节、上游地址或凭证的前提下，消费用户已经确认导入的地图源。它是 clean-room 兼容平台接口，不是奥维官方 SDK。

## 当前能力边界

每个源独立声明能力：

- `metadata`：可读取脱敏名称、协议、投影、状态、版权和本地链接。
- `temporal-catalog`：可按 AOI 和日期窗口列出时序条目。
- `tiles`：可通过本地网关读取已知 source/date/z/x/y 的瓦片。

确认导入但尚未完成 SSRF 策略、凭证保险库、最小探测和 ready 晋级的奥维兼容源只会得到 `metadata`，状态为 `metadata-only`。本机桥配置可与该 imported source 的同一 UUID 建立 `configured` runtime，但这仍只表示“配置已关联”，不表示服务器可达或影像可用。当前 `synthetic-lakes` 是离线契约验收源；它不能替代真实奥维图源验收。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/developer/sources` | 列出脱敏源与真实能力 |
| GET | `/api/v1/developer/sources/:id` | 读取单个脱敏源 |
| GET | `/api/v1/developer/sources/:id/dates?aoiId=&from=&to=` | 仅有 `temporal-catalog` 时可用 |
| GET | `/api/v1/developer/sources/:id/tiles/:dateId/:z/:x/:y` | 仅有 `tiles` 时可用；禁止任何查询参数 |

响应不会出现 `hosts`、`pathTemplate`、`queryParameters`、`credentialRef`、`sourceProvenance`、`compatibilityExtension`、输入哈希或原始载荷。调用方不能把上游 URL、host、token 或自定义请求头作为业务参数；唯一允许的认证头由 SDK 从本机应用令牌生成。

## 服务端身份与权限

直接连接 `127.0.0.1:4174` 的应用必须由操作者在进程环境配置独立令牌。每项包含与 manifest 完全一致的 app ID、32–256 字符本机秘密和允许的只读权限；只允许 `read-source-metadata`、`read-temporal-catalog`、`read-tiles`。示意值必须替换，真实令牌不得提交到仓库：

```bash
export OMB_DEVELOPER_TOKEN="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"
export OMB_DEVELOPER_TOKENS_JSON="$(node -e "process.stdout.write(JSON.stringify([{id:'org.example.history',token:process.env.OMB_DEVELOPER_TOKEN,permissions:['read-source-metadata','read-temporal-catalog','read-tiles']}]))")"
```

服务端按 URL 再判权限：源目录/详情需要 `read-source-metadata`，日期需要 `read-temporal-catalog`，瓦片需要 `read-tiles`；应用令牌不能访问导入、AOI、任务或健康接口。Bearer 正确但 app ID 不符同样拒绝。manifest 仍用于客户端预检查，但不能替代服务端授权。

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

const gatewayToken = process.env.OMB_DEVELOPER_TOKEN;
if (!gatewayToken) throw new Error('OMB_DEVELOPER_TOKEN is required');
const client = new OpenMapBridgeClient({ baseUrl: 'http://127.0.0.1:4174', manifest, gatewayToken });
const sources = await client.listSources();
const source = sources.find((entry) => entry.capabilities.includes('temporal-catalog'));

if (source) {
  const dates = await client.listDates(source, {
    aoiId: 'baoying-lake',
    from: '2006-01-01',
    to: '2025-12-31',
  });
  const tile = await client.fetchTile(source, { dateId: dates[0]!.id, z: 8, x: 212, y: 102 });
  console.log(tile.contentType, tile.body.byteLength);
}
```

完整可类型检查示例见 `packages/developer-sdk/examples/history-consumer.ts`。直连回环地址未传 app token 时构造器即失败；每个 JSON/瓦片请求都带 Bearer 和 manifest app ID。能力不足时 SDK 在执行 fetch 前抛出 `DeveloperSdkError`，`code` 为 `capability-not-available`；未知 API 版本、未知权限、非回环 base URL 和非法瓦片坐标同样 fail closed。

## 接入真实奥维图源的晋级门

1. 从二维码或 `.ovmap` 安全解析并确认，得到稳定 source ID。
2. 通过 URL/IP SSRF 策略和本地凭证保险库。
3. 运行时只能以同一个 source ID 绑定；legacy map type 只用于匹配配置，不能成为下游身份。
4. 以该 source ID 完成最小探测、图片解码和运行时 ready 晋级。
5. 只有真实日期目录和瓦片检查通过后，能力从 `metadata` 晋级为 `temporal-catalog`/`tiles`。
6. 行业应用继续使用相同 V1 SDK，不读取奥维私有格式。

V1 暂不提供插件市场、任意第三方代码执行、写图源、批量抓取或公网代理。
