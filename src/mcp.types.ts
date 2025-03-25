export interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface MCPInitializeParams {
  capabilities?: {
    workspace?: {
      workspaceFolders?: boolean;
      configuration?: boolean;
    };
  };
}

export interface MCPInitializeResult {
  /**
   * Protocol version in ISO date format (YYYY-MM-DD)
   * Example: '2024-11-05'
   */
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    toolsSupport: boolean;
    workspaceSupport: boolean;
  };
}

export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'getPodStatus',
    description: '获取 Pod 状态信息',
    parameters: {
      type: 'object',
      properties: {
        namespace: {
          type: 'string',
          description: '命名空间'
        }
      },
      required: []
    }
  },
  {
    name: 'describePod',
    description: '获取 Pod 详细信息',
    parameters: {
      type: 'object',
      properties: {
        namespace: {
          type: 'string',
          description: '命名空间'
        },
        podName: {
          type: 'string',
          description: 'Pod 名称'
        }
      },
      required: ['podName']
    }
  },
  {
    name: 'getPodLogs',
    description: '获取 Pod 日志',
    parameters: {
      type: 'object',
      properties: {
        namespace: {
          type: 'string',
          description: '命名空间'
        },
        podName: {
          type: 'string',
          description: 'Pod 名称'
        },
        container: {
          type: 'string',
          description: '容器名称'
        }
      },
      required: ['podName']
    }
  }
]; 