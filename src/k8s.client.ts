import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MCPConfig } from './types/mcp.config';
import * as yaml from 'yaml';

export class K8sClient {
  private static instance: K8sClient;
  private k8sApi!: k8s.CoreV1Api;
  private configPath: string;
  private initialized: boolean = false;

  private constructor() {
    this.configPath = path.join(os.homedir(), '.cursor', 'mcp.json');
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
      let configError: Error | null = null;

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
          configError = error as Error;
          console.warn(`Failed to load config from ${configPath}:`, error);
          continue;
        }
      }

      if (!configLoaded) {
        // 如果没有找到任何配置，使用默认的本地配置
        console.warn('No valid Kubernetes configuration found, using default local configuration');
        const defaultConfig = {
          apiVersion: 'v1',
          kind: 'Config',
          clusters: [{
            name: 'local-cluster',
            cluster: {
              server: 'http://localhost:8080',
              'insecure-skip-tls-verify': true
            }
          }],
          users: [{
            name: 'local-user',
            user: {
              username: 'admin',
              password: 'admin'
            }
          }],
          contexts: [{
            name: 'local-context',
            context: {
              cluster: 'local-cluster',
              user: 'local-user'
            }
          }],
          'current-context': 'local-context'
        };

        const tempConfigPath = path.join(os.tmpdir(), 'k8s-default-config.yaml');
        fs.writeFileSync(tempConfigPath, yaml.stringify(defaultConfig));
        kc.loadFromFile(tempConfigPath);
        fs.unlinkSync(tempConfigPath);
      }

      // 验证配置
      const contexts = kc.getContexts();
      if (!contexts || contexts.length === 0) {
        throw new Error('No valid contexts found in Kubernetes configuration');
      }

      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
      this.initialized = true;

      console.log('Successfully initialized Kubernetes client');
      console.log(`Available contexts: ${contexts.map(c => c.name).join(', ')}`);
    } catch (error) {
      console.error('Failed to initialize Kubernetes client:', error);
      throw error;
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
      console.error('Error getting pods:', error);
      throw error;
    }
  }

  public async describePod(name: string, namespace: string = 'default'): Promise<k8s.V1Pod> {
    await this.initializeClient();
    try {
      const opts = {
        name,
        namespace,
      } as unknown as k8s.CoreV1ApiReadNamespacedPodRequest;
      const response = await this.k8sApi.readNamespacedPod(opts);
      return response as unknown as k8s.V1Pod;
    } catch (error) {
      console.error('Error describing pod:', error);
      throw error;
    }
  }

  public async getPodLogs(name: string, namespace: string = 'default', container?: string): Promise<string> {
    await this.initializeClient();
    try {
      const opts = {
        name,
        namespace,
        container,
      } as unknown as k8s.CoreV1ApiReadNamespacedPodLogRequest;
      const response = await this.k8sApi.readNamespacedPodLog(opts);
      return response;
    } catch (error) {
      console.error('Error getting pod logs:', error);
      throw error;
    }
  }
}