export interface MCPConfig {
  apiServer: string;
  namespace: string;
  port?: number;
  host?: string;
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: {
        [key: string]: string;
      };
    };
  };
  kubernetes?: {
    clusters: Array<{
      name: string;
      cluster: {
        server: string;
        'insecure-skip-tls-verify'?: boolean;
      };
    }>;
    users: Array<{
      name: string;
      user: {
        username: string;
        password: string;
      };
    }>;
    contexts: Array<{
      name: string;
      context: {
        cluster: string;
        user: string;
      };
    }>;
    'current-context': string;
  };
} 