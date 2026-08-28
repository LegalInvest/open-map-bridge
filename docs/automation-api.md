# Automation API V1（准备度子集）

当前 API 只实现零外联 `source-readiness`，用于回答一个已保存图源在真实探测前还缺什么。它不执行 DNS、HTTP、瓦片或日期请求，也不证明图源可用。

## 资源

```text
GET  /api/v1/processes
POST /api/v1/processes/source-readiness/execution
GET  /api/v1/jobs
GET  /api/v1/jobs/{jobId}
```

创建请求严格为：

```json
{ "sourceId": "saved-source-id" }
```

额外字段、未知 source ID、URL、host、token、请求头或跳步参数均不接受。首次创建返回 `201` 和 `{ run, created: true }`；源配置与运行时事实没有变化时返回 `200`、原 run 和 `created: false`。

## 四个固定步骤

1. `source-confirmed`：确认图源已经由用户授权保存；不表示可用。
2. `network-policy`：只检查保存后的 path/host/port/IP。云元数据和危险路径永久阻断；私网、裸 IP、企业域名和非标准端口进入人工门。它不解析 DNS。
3. `credential-readiness`：只读 `credentialRequired`/`credentialRef` 的脱敏事实。不透明奥维配置交给受控本机桥，任务账本不保存私有载荷。
4. `runtime-binding`：只读当前 registry。奥维桥还要求 legacy map type 匹配；`configured` 不等于 `ready`。

每个 step 明确记录 `status`、`attempt`、起止时间、`externalRequest`、稳定错误码、消息和下一动作。当前流程的 `externalRequest` 必须全部为 `false`。

## 状态和持久化

run 状态可为 `blocked`、`awaiting-intervention` 或 `completed`；schema 为后续流程保留 running/partial/failed/cancelled。步骤状态为 pending/running/succeeded/blocked/skipped/retryable-failed。

输入指纹包含流程/策略版本、源状态、更新时间、脱敏凭证存在性、主机/路径兼容事实和匹配运行时的 ID/type/availability。状态仓库用串行写队列、临时文件同步和原子 rename 保存；并发重复创建只追加一次。

## 明确未实现

- 凭证明文保险库和人工门提交接口；
- 请求时 DNS 解析后 IP、DNS 重绑定和 HTTP 最小探测；
- 步骤级 resume/retry/cancel、events 和 results；
- AOI、日期目录、四期选择、瓦片质量和比较回执。

上述能力必须各自增加负面测试和真实证据，不能由当前静态任务状态推断。
