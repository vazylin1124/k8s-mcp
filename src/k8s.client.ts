import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MCPConfig } from './types/mcp.config';
import * as yaml from 'yaml';
import { MockK8sClient } from './k8s.mock';

// 创建自定义日志函数
const log = {
  info: (...args: any[]) => console.error('[INFO]', ...args),
  warn: (...args: any[]) => console.error('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

export class K8sClient {
  private static instance: K8sClient;
  private k8sApi!: k8s.CoreV1Api;
  private configPath: string;
  private initialized: boolean = false;
  private mockClient: MockK8sClient;
  private useMock: boolean = false;

  private constructor() {
    this.configPath = path.join(os.homedir(), '.cursor', 'mcp.json');
    this.mockClient = MockK8sClient.getInstance();
  }

  private async initializeClient(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const kc = new k8s.KubeConfig();
      
      // 尝试从多个位置加载配置
      const configLocations = [
        this.configPath, // MCP JSON 配置
        path.join(process.cwd(), 'k8s_config.yaml'), // 项目根目录的 YAML 配置
        path.join(os.homedir(), '.kube', 'config'), // 默认的 kubeconfig 位置
      ];

      let configLoaded = false;

      for (const configPath of configLocations) {
        try {
          if (fs.existsSync(configPath)) {
            if (configPath.endsWith('.json')) {
              // 处理 MCP JSON 配置
              const configContent = fs.readFileSync(configPath, 'utf-8');
              const mcpConfig: MCPConfig = JSON.parse(configContent);

              if (mcpConfig.kubernetes) {
                const kubeConfig = {
                  apiVersion: 'v1',
                  kind: 'Config',
                  clusters: mcpConfig.kubernetes.clusters,
                  users: mcpConfig.kubernetes.users,
                  contexts: mcpConfig.kubernetes.contexts,
                  'current-context': mcpConfig.kubernetes['current-context']
                };

                const tempConfigPath = path.join(os.tmpdir(), 'k8s-mcp-config.yaml');
                fs.writeFileSync(tempConfigPath, yaml.stringify(kubeConfig));
                kc.loadFromFile(tempConfigPath);
                fs.unlinkSync(tempConfigPath);
                configLoaded = true;
                break;
              }
            } else {
              // 处理 YAML 配置
              kc.loadFromFile(configPath);
              configLoaded = true;
              break;
            }
          }
        } catch (error) {
          log.warn(`Failed to load config from ${configPath}:`, error);
          continue;
        }
      }

      if (!configLoaded) {
        log.warn('No valid Kubernetes configuration found, using mock client');
        this.useMock = true;
        this.initialized = true;
        return;
      }

      // 验证配置
      const contexts = kc.getContexts();
      if (!contexts || contexts.length === 0) {
        log.warn('No valid contexts found in Kubernetes configuration, using mock client');
        this.useMock = true;
        this.initialized = true;
        return;
      }

      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
      this.initialized = true;

      log.info('Successfully initialized Kubernetes client');
      log.info(`Available contexts: ${contexts.map(c => c.name).join(', ')}`);
    } catch (error) {
      log.warn('Failed to initialize Kubernetes client, using mock client:', error);
      this.useMock = true;
      this.initialized = true;
    }
  }

  public static getInstance(): K8sClient {
    if (!K8sClient.instance) {
      K8sClient.instance = new K8sClient();
    }
    return K8sClient.instance;
  }

  public async getPods(namespace?: string): Promise<k8s.V1PodList> {
    await this.initializeClient();
    if (this.useMock) {
      return this.mockClient.getPods(namespace);
    }
    try {
      if (namespace) {
        const opts = {
          namespace,
        } as unknown as k8s.CoreV1ApiListNamespacedPodRequest;
        const response = await this.k8sApi.listNamespacedPod(opts);
        return response as unknown as k8s.V1PodList;
      } else {
        const response = await this.k8sApi.listPodForAllNamespaces();
        return response as unknown as k8s.V1PodList;
      }
    } catch (error) {
      log.error('Error getting pods:', error);
      return this.mockClient.getPods(namespace);
    }
  }

  public async describePod(name: string, namespace: string = 'default'): Promise<k8s.V1Pod> {
    await this.initializeClient();
    if (this.useMock) {
      return this.mockClient.describePod(name, namespace);
    }
    try {
      const opts = {
        name,
        namespace,
      } as unknown as k8s.CoreV1ApiReadNamespacedPodRequest;
      const response = await this.k8sApi.readNamespacedPod(opts);
      return response as unknown as k8s.V1Pod;
    } catch (error) {
      log.error('Error describing pod:', error);
      return this.mockClient.describePod(name, namespace);
    }
  }

  public async getPodLogs(name: string, namespace: string = 'default', container?: string): Promise<string> {
    await this.initializeClient();
    if (this.useMock) {
      return this.mockClient.getPodLogs(name, namespace, container);
    }
    try {
      const opts = {
        name,
        namespace,
        container,
      } as unknown as k8s.CoreV1ApiReadNamespacedPodLogRequest;
      const response = await this.k8sApi.readNamespacedPodLog(opts);
      return response;
    } catch (error) {
      log.error('Error getting pod logs:', error);
      return this.mockClient.getPodLogs(name, namespace, container);
    }
  }
}