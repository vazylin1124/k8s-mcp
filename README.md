# K8s MCP (Kubernetes Management Control Panel)

一个简单的 Kubernetes 集群管理工具,提供 MCP JSON-RPC 接口来查询和管理 Kubernetes 资源。

## 功能特性

- MCP JSON-RPC 协议支持
- Pod 状态查询
- Pod 详情查看
- Pod 日志获取
- 支持多命名空间
- 友好的错误处理

## 安装

```bash
# 克隆项目
git clone https://github.com/vazylin1124/k8s-mcp.git

# 安装依赖
cd k8s-mcp
npm install
```

## 配置

1. 在项目根目录创建 `k8s_config.yaml` 文件
2. 将 Kubernetes 集群的配置信息复制到该文件中

## 运行

```bash
npm start
```

服务将在 3000 端口启动。

## MCP JSON-RPC 接口

所有请求都应发送到 `/mcp` 端点。

### 初始化
```json
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
```

### 获取工具列表
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

### 查询 Pod 状态
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "getPodStatus",
  "params": {
    "namespace": "default"  // 可选
  }
}
```

### 查看 Pod 详情
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "describePod",
  "params": {
    "namespace": "default",  // 可选,默认为 default
    "podName": "my-pod"     // 必填
  }
}
```

### 获取 Pod 日志
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "getPodLogs",
  "params": {
    "namespace": "default",  // 可选,默认为 default
    "podName": "my-pod",    // 必填
    "container": "main"     // 可选
  }
}
```

## 错误处理

服务使用标准的 JSON-RPC 2.0 错误码:

- -32700: Parse error
- -32600: Invalid Request
- -32601: Method not found
- -32602: Invalid params
- -32603: Internal error
- -32000: Server error

## 开发

项目使用 TypeScript 开发,主要文件结构:

```
src/
  ├── index.ts          # 主入口文件
  ├── mcp.types.ts      # MCP 类型定义
  ├── mcp.controller.ts # MCP 控制器
  ├── k8s.config.ts     # Kubernetes 配置管理
  └── k8s.client.ts     # Kubernetes API 客户端
```

## License

MIT