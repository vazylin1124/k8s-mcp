import express from 'express';
import type { Request, Response } from 'express';
import { K8sClient } from './k8s.client.js';
import { MCPController } from './mcp.controller.js';
import type { V1Pod, V1ContainerStatus, V1PodCondition } from '@kubernetes/client-node';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import * as readline from 'readline';

// 创建自定义日志函数，使用标准错误输出
const log = {
  info: (...args: any[]) => process.stderr.write(`[INFO] ${args.join(' ')}\n`),
  warn: (...args: any[]) => process.stderr.write(`[WARN] ${args.join(' ')}\n`),
  error: (...args: any[]) => process.stderr.write(`[ERROR] ${args.join(' ')}\n`)
};

// 检查是否通过 Smithery 运行
const isSmithery = process.env.SMITHERY === 'true';

// 初始化 MCP 控制器
let mcpController: MCPController;
try {
  mcpController = new MCPController();
} catch (error: any) {
  log.error(`Failed to initialize MCP controller: ${error.message}`);
  process.exit(1);
}

if (isSmithery) {
  // Smithery 模式：通过 stdio 进行 JSON-RPC 通信
  log.info('Starting server in Smithery mode');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  // 处理输入的 JSON-RPC 请求
  rl.on('line', async (line) => {
    try {
      // 解析并处理请求
      const request = JSON.parse(line);
      log.info('Received request:', JSON.stringify(request));
      
      const response = await mcpController.handleWebSocketRequest(request);
      log.info('Sending response:', JSON.stringify(response));
      
      // 将响应写入标准输出
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (error: any) {
      // 错误也需要以 JSON-RPC 格式返回
      log.error(`Error handling request: ${error.message}`);
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Internal error',
          data: error.message
        },
        id: null
      }) + '\n');
    }
  });

  // 处理错误
  rl.on('error', (error: Error) => {
    log.error(`Readline error: ${error.message}`);
  });

  // 处理关闭
  rl.on('close', () => {
    log.error('Stdin closed, exiting...');
    process.exit(0);
  });

  // 初始化完成的日志输出到标准错误
  log.info('MCP server initialized in Smithery mode');
} else {
  // HTTP/WebSocket 模式
  log.info('Starting server in HTTP mode');
  
  const app = express();
  let port = parseInt(process.env.PORT || '3000', 10);
  const maxRetries = 10;
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
  app.post('/mcp', async (req, res) => {
    try {
      log.info('Received HTTP request:', JSON.stringify(req.body));
      const response = await mcpController.handleWebSocketRequest(req.body);
      log.info('Sending HTTP response:', JSON.stringify(response));
      res.json(response);
    } catch (error: any) {
      log.error(`Error handling HTTP request: ${error.message}`);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Internal error',
          data: error.message
        },
        id: null
      });
    }
  });

  // 创建 HTTP 服务器
  const server = createServer(app);

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ server, path: '/mcp' });

  // 处理 WebSocket 连接
  wss.on('connection', (ws: WebSocket) => {
    log.info('WebSocket client connected');

    ws.on('message', async (message: string) => {
      try {
        const request = JSON.parse(message.toString());
        log.info('Received WebSocket request:', JSON.stringify(request));
        
        const response = await mcpController.handleWebSocketRequest(request);
        log.info('Sending WebSocket response:', JSON.stringify(response));
        
        ws.send(JSON.stringify(response));
      } catch (error: any) {
        log.error(`WebSocket error: ${error.message}`);
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
      log.error(`WebSocket error: ${error.message}`);
    });

    ws.on('close', () => {
      log.info('WebSocket client disconnected');
    });
  });

  // 启动服务器
  async function startServer(retryCount = 0): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        server.listen(port, '0.0.0.0')
          .once('listening', () => {
            log.info(`Server is running on port ${port}`);
            resolve();
          })
          .once('error', (error: any) => {
            if (error.code === 'EADDRINUSE' && retryCount < maxRetries) {
              log.warn(`Port ${port} is in use, trying port ${port + 1}`);
              server.close();
              port++;
              startServer(retryCount + 1).then(resolve).catch(reject);
            } else {
              reject(error);
            }
          });
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`Failed to start server: ${errorMessage}`);
      process.exit(1);
    }
  }

  startServer();
}