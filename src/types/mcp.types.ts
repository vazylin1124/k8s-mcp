export interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPInitializeParams {
  processId: number | null;
  clientInfo?: {
    name: string;
    version?: string;
  };
  locale?: string;
  rootPath?: string | null;
  rootUri?: string | null;
  capabilities?: object;
  trace?: 'off' | 'messages' | 'verbose';
  workspaceFolders?: Array<{
    uri: string;
    name: string;
  }> | null;
}

export interface MCPInitializeResult {
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

export const SUPPORTED_PROTOCOL_VERSION = '2024-11-05';

export const MCP_TOOLS = {
  TOOLS_LIST: 'tools/list',
  INITIALIZE: 'initialize',
  SHUTDOWN: 'shutdown',
  EXIT: 'exit'
}; 