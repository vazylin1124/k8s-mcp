import { Request, Response } from 'express';
import {
  MCPRequest,
  MCPResponse,
  MCPInitializeParams,
  MCPInitializeResult,
  MCP_TOOLS,
  SUPPORTED_PROTOCOL_VERSION
} from '../types/mcp.types';
import { K8sClient } from '../services/k8s.client';
import { log } from '../utils/logger';

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
  private tools: any[];

  constructor() {
    this.k8sClient = K8sClient.getInstance();
    this.tools = [
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
  }

  public async handleWebSocketRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      // 验证 JSON-RPC 请求
      if (!this.isValidJsonRpcRequest(request)) {
        return {
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request'
          },
          id: null
        };
      }

      // 处理方法调用
      let result;
      switch (request.method) {
        case 'initialize':
          result = await this.initialize(request.params);
          break;
        case 'get_tools':
        case 'tools/list':
          result = this.tools;
          break;
        case 'get_pod_status':
          result = await this.k8sClient.getPods(request.params?.namespace);
          break;
        case 'describe_pod':
          result = await this.k8sClient.describePod(
            request.params.pod_name,
            request.params.namespace
          );
          break;
        case 'get_pod_logs':
          result = await this.k8sClient.getPodLogs(
            request.params.pod_name,
            request.params.namespace,
            request.params.container
          );
          break;
        default:
          return {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: 'Method not found'
            },
            id: request.id
          };
      }

      return {
        jsonrpc: '2.0',
        result,
        id: request.id
      };
    } catch (error: any) {
      log.error('Error handling WebSocket request:', error);
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Internal error',
          data: error.message
        },
        id: request.id
      };
    }
  }

  public async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      const jsonRpcRequest = req.body as JsonRpcRequest;
      const response = await this.handleWebSocketRequest(jsonRpcRequest);
      res.json(response);
    } catch (error: any) {
      log.error('Error handling HTTP request:', error);
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

  private async initialize(params: MCPInitializeParams): Promise<MCPInitializeResult> {
    return {
      protocolVersion: SUPPORTED_PROTOCOL_VERSION,
      serverInfo: {
        name: 'k8s-mcp',
        version: '1.0.0'
      },
      capabilities: {
        toolsSupport: true,
        workspaceSupport: false
      }
    };
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