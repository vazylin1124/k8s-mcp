import express, { Request, Response } from 'express';
import { K8sClient } from './k8s.client';
import { MCPController } from './mcp.controller';
import { V1Pod, V1ContainerStatus } from '@kubernetes/client-node';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import * as readline from 'readline';

// 创建自定义日志函数，使用标准错误输出
const log = {
  info: (...args: any[]) => console.error('[INFO]', ...args),
  warn: (...args: any[]) => console.error('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

const mcpController = new MCPController();

// 检查是否通过 Smithery 运行
const isSmithery = process.env.SMITHERY === 'true';

if (isSmithery) {
  // 通过 stdio 进行 JSON-RPC 通信
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      const response = await mcpController.handleWebSocketRequest(request);
      console.log(JSON.stringify(response));
    } catch (error: any) {
      log.error('Error handling stdio request:', error);
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Internal error',
          data: error.message
        },
        id: null
      }));
    }
  });

  // 错误处理
  rl.on('error', (error) => {
    log.error('Readline error:', error);
  });

  // 关闭处理
  rl.on('close', () => {
    log.info('Stdin closed, exiting...');
    process.exit(0);
  });
} else {
  // 正常的 HTTP/WebSocket 服务器模式
  const app = express();
  const port = parseInt(process.env.PORT || '3000', 10);
  const k8sClient = K8sClient.getInstance();

  // 中间件
  app.use(express.json());

  // 错误处理中间件
  app.use((err: any, req: Request, res: Response, next: any) => {
    log.error('Express error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Internal server error',
          data: err.message
        },
        id: null
      });
    }
  });

  interface ErrorResponse {
    content: Array<{ type: string; text: string }>;
    isError: boolean;
  }

  interface K8sRequestParams {
    namespace?: string;
    pod_name?: string;
    selector?: string;
    kubeconfig_path?: string;
    context?: string;
    all_namespaces?: boolean;
    container?: string;
    tail_lines?: number;
    previous?: boolean;
  }

  // Pod 状态检查
  app.post('/api/k8s/pods/status', async (req: Request<{}, {}, K8sRequestParams>, res: Response) => {
    try {
      const params = req.body;
      const podsResponse = await k8sClient.getPods(params.namespace);
      
      let formattedOutput = '```\n';
      formattedOutput += 'NAMESPACE  NAME  READY  STATUS  RESTARTS  AGE  IP  NODE\n';
      
      const podStatuses: Record<string, number> = {};
      const problemPods: Array<{ namespace: string; podName: string; status: string }> = [];
      
      for (const pod of podsResponse.items) {
        if (!pod.status || !pod.metadata || !pod.spec) {
          log.warn('Skipping pod with missing required fields');
          continue;
        }

        const status = pod.status.phase || 'Unknown';
        const namespace = pod.metadata.namespace || 'default';
        const name = pod.metadata.name || 'unknown';
        
        const containerStatuses: V1ContainerStatus[] = pod.status.containerStatuses || [];
        const readyContainers = containerStatuses.filter(c => c.ready).length;
        const totalContainers = pod.spec.containers?.length || 0;
        const ready = `${readyContainers}/${totalContainers}`;
        
        const restarts = containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0);
        const creationTime = pod.metadata.creationTimestamp 
          ? new Date(pod.metadata.creationTimestamp).getTime()
          : Date.now();
        const age = Math.floor((Date.now() - creationTime) / 1000 / 60);
        
        const ip = pod.status.podIP || '';
        const node = pod.spec.nodeName || '';
        
        formattedOutput += `${namespace}  ${name}  ${ready}  ${status}  ${restarts}  ${age}m  ${ip}  ${node}\n`;
        
        podStatuses[status] = (podStatuses[status] || 0) + 1;
        
        if (status !== 'Running' && status !== 'Completed') {
          problemPods.push({ namespace, podName: name, status });
        }
      }
      
      formattedOutput += '```\n\n';
      
      // 添加状态摘要
      formattedOutput += '### Pod Status Summary\n';
      for (const [status, count] of Object.entries(podStatuses)) {
        formattedOutput += `- ${status}: ${count} pod(s)\n`;
      }
      
      // 添加问题 Pod 信息
      if (problemPods.length > 0) {
        formattedOutput += '\n### Problem Pods\n';
        for (const pod of problemPods) {
          formattedOutput += `- Namespace: ${pod.namespace}, Pod: ${pod.podName}, Status: ${pod.status}\n`;
          
          try {
            const podDetails = await k8sClient.describePod(pod.podName, pod.namespace);
            if (podDetails.status?.conditions) {
              const events = podDetails.status.conditions
                .map(condition => {
                  const time = condition.lastTransitionTime || '';
                  const type = condition.type || '';
                  const status = condition.status || '';
                  const reason = condition.reason || '';
                  const message = condition.message || '';
                  return `${time} ${type} ${status} ${reason} ${message}`;
                })
                .join('\n');
              
              if (events) {
                formattedOutput += '\n  Recent events:\n```\n' + events + '\n```\n';
              }
            }
          } catch (error: any) {
            formattedOutput += `\n  Could not get pod details: ${error.message}\n`;
          }
        }
      }
      
      res.json({
        content: [{ type: 'text', text: formattedOutput }]
      });
    } catch (error: any) {
      log.error('Error in check_pod_status:', error);
      res.status(500).json({
        content: [{ type: 'text', text: `Error checking pod status: ${error.message}` }],
        isError: true
      });
    }
  });

  // Pod 详情
  app.post('/api/k8s/pods/describe', async (req: Request<{}, {}, K8sRequestParams>, res: Response) => {
    try {
      const params = req.body;
      if (!params.pod_name) {
        return res.status(400).json({
          content: [{ type: 'text', text: 'Pod name is required' }],
          isError: true
        });
      }

      const podDetails = await k8sClient.describePod(params.pod_name, params.namespace);
      const formattedOutput = JSON.stringify(podDetails, null, 2);
      
      res.json({
        content: [{ type: 'text', text: '```\n' + formattedOutput + '\n```' }]
      });
    } catch (error: any) {
      log.error('Error in describe_pod:', error);
      res.status(500).json({
        content: [{ type: 'text', text: `Error describing pod: ${error.message}` }],
        isError: true
      });
    }
  });

  // Pod 日志
  app.post('/api/k8s/pods/logs', async (req: Request<{}, {}, K8sRequestParams>, res: Response) => {
    try {
      const params = req.body;
      if (!params.pod_name) {
        return res.status(400).json({
          content: [{ type: 'text', text: 'Pod name is required' }],
          isError: true
        });
      }

      const logs = await k8sClient.getPodLogs(params.pod_name, params.namespace, params.container);
      
      if (!logs || !logs.trim()) {
        return res.json({
          content: [{ type: 'text', text: 'No logs available for the specified pod/container.' }]
        });
      }
      
      res.json({
        content: [{ type: 'text', text: '```\n' + logs + '\n```' }]
      });
    } catch (error: any) {
      log.error('Error in get_pod_logs:', error);
      res.status(500).json({
        content: [{ type: 'text', text: `Error retrieving pod logs: ${error.message}` }],
        isError: true
      });
    }
  });

  // MCP JSON-RPC HTTP 路由
  app.post('/mcp', (req, res) => mcpController.handleRequest(req, res));

  async function startServer() {
    try {
      // 创建 HTTP 服务器
      const server = createServer(app);

      // 创建 WebSocket 服务器
      const wss = new WebSocketServer({ server, path: '/mcp' });

      // 处理 WebSocket 连接
      wss.on('connection', (ws: WebSocket) => {
        log.info('WebSocket client connected');

        ws.on('message', async (message: string) => {
          try {
            const request = JSON.parse(message);
            const response = await mcpController.handleWebSocketRequest(request);
            ws.send(JSON.stringify(response));
          } catch (error: any) {
            log.error('WebSocket error:', error);
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Internal error',
                data: error.message
              },
              id: null
            }));
          }
        });

        ws.on('error', (error: Error) => {
          log.error('WebSocket error:', error);
        });

        ws.on('close', () => {
          log.info('WebSocket client disconnected');
        });
      });

      // 启动服务器
      server.listen(port, '0.0.0.0', () => {
        log.info(`Server is running on port ${port}`);
      });
    } catch (error) {
      log.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  startServer();
}