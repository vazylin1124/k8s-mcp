import { Request, Response } from 'express';
import { MCPRequest, MCPResponse, MCPInitializeParams, MCPInitializeResult, MCP_TOOLS } from './mcp.types';
import { K8sClient } from './k8s.client';

// 创建自定义日志函数
const log = {
  info: (...args: any[]) => console.error('[INFO]', ...args),
  warn: (...args: any[]) => console.error('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: any;
  id: string | number | null;
}

interface JsonRpcResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

export class MCPController {
  private k8sClient: K8sClient;

  constructor() {
    this.k8sClient = K8sClient.getInstance();
  }

  private createResponse(request: MCPRequest, result?: any, error?: { code: number; message: string; data?: any }): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
      error
    };
  }

  public async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      const jsonRpcRequest = req.body as JsonRpcRequest;

      // 验证 JSON-RPC 请求
      if (!this.isValidJsonRpcRequest(jsonRpcRequest)) {
        this.sendJsonRpcError(res, -32600, 'Invalid Request', null);
        return;
      }

      // 处理方法调用
      switch (jsonRpcRequest.method) {
        case 'initialize':
          await this.handleInitialize(jsonRpcRequest, res);
          break;
        case 'get_tools':
          await this.handleGetTools(jsonRpcRequest, res);
          break;
        case 'get_pod_status':
          await this.handleGetPodStatus(jsonRpcRequest, res);
          break;
        case 'describe_pod':
          await this.handleDescribePod(jsonRpcRequest, res);
          break;
        case 'get_pod_logs':
          await this.handleGetPodLogs(jsonRpcRequest, res);
          break;
        default:
          this.sendJsonRpcError(res, -32601, 'Method not found', jsonRpcRequest.id);
      }
    } catch (error: any) {
      log.error('Error handling MCP request:', error);
      this.sendJsonRpcError(res, -32000, 'Internal error', null, error.message);
    }
  }

  private isValidJsonRpcRequest(request: any): request is JsonRpcRequest {
    return (
      request &&
      request.jsonrpc === '2.0' &&
      typeof request.method === 'string' &&
      (request.id === null || typeof request.id === 'string' || typeof request.id === 'number')
    );
  }

  private async handleInitialize(request: JsonRpcRequest, res: Response): Promise<void> {
    const result = await this.initialize(request.params);
    this.sendJsonRpcResponse(res, result, request.id);
  }

  private async handleGetTools(request: JsonRpcRequest, res: Response): Promise<void> {
    const tools = [
      {
        name: 'k8s_pod_status',
        description: 'Get Kubernetes pod status',
        parameters: {
          namespace: { type: 'string', optional: true },
          selector: { type: 'string', optional: true }
        }
      },
      {
        name: 'k8s_pod_describe',
        description: 'Describe Kubernetes pod',
        parameters: {
          namespace: { type: 'string', optional: true },
          pod_name: { type: 'string', required: true }
        }
      },
      {
        name: 'k8s_pod_logs',
        description: 'Get Kubernetes pod logs',
        parameters: {
          namespace: { type: 'string', optional: true },
          pod_name: { type: 'string', required: true },
          container: { type: 'string', optional: true }
        }
      }
    ];

    this.sendJsonRpcResponse(res, tools, request.id);
  }

  private async handleGetPodStatus(request: JsonRpcRequest, res: Response): Promise<void> {
    const result = await this.k8sClient.getPods(request.params?.namespace);
    this.sendJsonRpcResponse(res, result, request.id);
  }

  private async handleDescribePod(request: JsonRpcRequest, res: Response): Promise<void> {
    const result = await this.k8sClient.describePod(
      request.params.pod_name,
      request.params.namespace
    );
    this.sendJsonRpcResponse(res, result, request.id);
  }

  private async handleGetPodLogs(request: JsonRpcRequest, res: Response): Promise<void> {
    const result = await this.k8sClient.getPodLogs(
      request.params.pod_name,
      request.params.namespace,
      request.params.container
    );
    this.sendJsonRpcResponse(res, result, request.id);
  }

  private async initialize(params: MCPInitializeParams): Promise<MCPInitializeResult> {
    return {
      capabilities: {
        toolsSupport: true,
        workspaceSupport: false
      }
    };
  }

  private sendJsonRpcResponse(res: Response, result: any, id: string | number | null): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      result,
      id
    };
    res.json(response);
  }

  private sendJsonRpcError(
    res: Response,
    code: number,
    message: string,
    id: string | number | null,
    data?: any
  ): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        data
      },
      id
    };
    res.status(code === -32000 ? 500 : 400).json(response);
  }
} 