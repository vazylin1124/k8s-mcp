# K8s MCP (Kubernetes Management Control Panel)

一个简单的 Kubernetes 集群管理工具,提供 RESTful API 接口来查询和管理 Kubernetes 资源。

## 功能特性

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

## API 接口

### 查询 Pod 状态
- 接口: POST /api/k8s/pods/status
- 参数: 
  ```json
  {
    "namespace": "default"  // 可选,不传则查询所有命名空间
  }
  ```

### 查看 Pod 详情
- 接口: POST /api/k8s/pods/describe
- 参数:
  ```json
  {
    "namespace": "default",  // 可选,默认为 default
    "pod_name": "my-pod"    // 必填
  }
  ```

### 获取 Pod 日志
- 接口: POST /api/k8s/pods/logs
- 参数:
  ```json
  {
    "namespace": "default",  // 可选,默认为 default
    "pod_name": "my-pod",   // 必填
    "container": "main"     // 可选,不传则获取第一个容器
  }
  ```

## 开发

项目使用 TypeScript 开发,主要文件结构:

```
src/
  ├── index.ts          # 主入口文件
  ├── k8s.config.ts     # Kubernetes 配置管理
  └── k8s.client.ts     # Kubernetes API 客户端
```

## License

MIT 