# K8s MCP (Kubernetes Management Control Panel)

一个简单的 Kubernetes 集群管理工具，支持两种运行模式：
1. HTTP/WebSocket JSON-RPC 模式
2. Smithery stdio JSON-RPC 模式

## 运行模式说明

### 1. HTTP/WebSocket JSON-RPC 模式 (默认)

在此模式下，服务器监听 HTTP 请求：
```bash
# 启动服务器（HTTP 模式）
SMITHERY=false node -r dotenv/config dist/index.js
```

所有 JSON-RPC 请求都应发送到 `/mcp` 端点：
```bash
# 示例：获取工具列表
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### 2. Smithery stdio JSON-RPC 模式

在此模式下，服务器通过标准输入/输出进行通信：
```bash
# 启动服务器（Smithery 模式）
SMITHERY=true node -r dotenv/config dist/index.js
```

JSON-RPC 消息直接通过标准输入/输出传递：
```json
// 示例：初始化请求
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "capabilities": {
      "workspace": {
        "workspaceFolders": false,
        "configuration": false
      }
    }
  }
}

// 示例：获取工具列表
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

## 支持的 JSON-RPC 方法

1. `initialize` - 初始化服务
   - 返回协议版本 (2024-11-05)
   - 返回服务器信息和功能

2. `tools/list` 或 `get_tools` - 获取可用工具列表
   - 返回支持的工具列表

3. `get_pod_status` - 获取 Pod 状态
   - 参数：
     - namespace (可选): 命名空间

4. `describe_pod` - 获取 Pod 详情
   - 参数：
     - namespace (可选): 命名空间
     - pod_name (必填): Pod 名称

5. `get_pod_logs` - 获取 Pod 日志
   - 参数：
     - namespace (可选): 命名空间
     - pod_name (必填): Pod 名称
     - container (可选): 容器名称

## 错误处理

服务使用标准的 JSON-RPC 2.0 错误码:
- -32700: Parse error
- -32600: Invalid Request
- -32601: Method not found
- -32602: Invalid params
- -32603: Internal error
- -32000: Server error

## 开发

```bash
# 安装依赖
npm install

# 开发模式（HTTP）
npm run dev

# 开发模式（Smithery）
SMITHERY=true npm run dev

# 构建
npm run build

# 生产模式运行（HTTP）
SMITHERY=false node -r dotenv/config dist/index.js

# 生产模式运行（Smithery）
SMITHERY=true node -r dotenv/config dist/index.js
```

## Docker 部署

```bash
# 构建镜像
docker build -t k8s-mcp:latest .

# HTTP 模式运行
docker run -p 3000:3000 k8s-mcp:latest

# Smithery 模式运行
docker run -e SMITHERY=true k8s-mcp:latest
```

## Kubernetes 部署

```bash
# HTTP 模式部署
kubectl apply -f k8s/deployment.yaml

# Smithery 模式部署（修改 SMITHERY 环境变量为 true）
kubectl set env deployment/k8s-mcp SMITHERY=true
```

## 协议版本

服务器支持的协议版本：2024-11-05

## License

MIT