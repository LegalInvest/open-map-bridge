# SLICE-V0-SDK-001 本地验收

日期：2026-08-28（Asia/Shanghai）

## 结论

开发者 V1 薄切片达到 `local-verified`：代表性应用可通过严格清单和 TypeScript SDK 列出脱敏源、发现能力、读取合成时序目录并构造本地瓦片 URL。已确认但没有运行时绑定的奥维兼容源只返回 `metadata`；配置但未探测的 OviBridge 同样不授予日期或瓦片能力。

这不代表真实奥维历史影像已出图，也不代表 `main`、`deployed` 或用户 `accepted`。

## 已核验行为

- 开发者响应采用字段白名单，不含上游 host/path/query、`credentialRef`、输入哈希、兼容私有扩展或原始载荷。
- 未声明 `temporal-catalog`/`tiles` 的源由 SDK 在 fetch 前拒绝，错误码为 `capability-not-available`。
- 应用清单对未知 API 版本、未知权限、额外字段和能力—权限不匹配 fail closed。
- SDK 只接受回环 base URL，只生成 `/api/v1/developer` 本地路径。
- 日期接口只接受 `aoiId/from/to`；瓦片接口拒绝查询参数、非法坐标、z 大于 30 和超出层级范围的 x/y。
- 实际 HTTP 返回 1 个合成 ready 源、2006–2025 共 20 个日期，代表性瓦片为 HTTP 200 `image/svg+xml`。

## 复验命令与结果

```text
npm test
  92 Vitest + 2 Node passed

npm run typecheck
  8 workspaces passed

npm run build
  gateway and web production build passed

npm run test:e2e
  4 Chrome journeys passed

OMB_ACCEPTANCE_QR=<authorized local image> npm run test:e2e:authorized-qr
  2 authorized local compatibility journeys passed
```

授权二维码载荷、上游地址、秘密和瓦片正文未写入本验收记录。

## 下一门

以已确认 imported source 的同一 source ID 完成 URL/IP SSRF、凭证保险库、最小探测和 OviBridge/标准适配器绑定；然后通过 V1 SDK 取得真实日期目录和至少两个不同的非空真实瓦片。
