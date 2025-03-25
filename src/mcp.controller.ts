import { Request, Response } from 'express';
import { MCPRequest, MCPResponse, MCPInitializeParams, MCPInitializeResult, MCP_TOOLS } from './mcp.types';
import { K8sClient } from './k8s.client';

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

  async handleRequest(req: Request, res: Response) {
    const mcpRequest: MCPRequest = req.body;

    try {
      let result;

      switch (mcpRequest.method) {
        case 'initialize':
          result = await this.initialize(mcpRequest.params);
          break;
        case 'tools/list':
          result = await this.listTools();
          break;
        case 'getPodStatus':
          result = await this.k8sClient.getPods(mcpRequest.params?.namespace);
          break;
        case 'describePod':
          result = await this.k8sClient.describePod(mcpRequest.params.podName, mcpRequest.params.namespace);
          break;
        case 'getPodLogs':
          result = await this.k8sClient.getPodLogs(mcpRequest.params.podName, mcpRequest.params.namespace, mcpRequest.params.container);
          break;
        default:
          return res.status(400).json(this.createResponse(mcpRequest, undefined, {
            code: -32601,
            message: 'Method not found'
          }));
      }

      res.json(this.createResponse(mcpRequest, result));
    } catch (error: any) {
      res.status(500).json(this.createResponse(mcpRequest, undefined, {
        code: -32000,
        message: error.message || 'Internal error',
        data: error
      }));
    }
  }

  private async initialize(params: MCPInitializeParams): Promise<MCPInitializeResult> {
    return {
      capabilities: {
        toolsSupport: true,
        workspaceSupport: false
      }
    };
  }

  private async listTools() {
    return {
      tools: MCP_TOOLS
    };
  }
} 