import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MCPConfig } from './types/mcp.config';

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
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`MCP 配置文件不存在: ${this.configPath}`);
      }

      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const mcpConfig: MCPConfig = JSON.parse(configContent);

      if (!mcpConfig.kubernetes) {
        throw new Error('MCP 配置文件中缺少 kubernetes 配置');
      }

      const kc = new k8s.KubeConfig();
      
      // 将 MCP 配置转换为 KubeConfig 格式
      const kubeConfig = {
        apiVersion: 'v1',
        kind: 'Config',
        clusters: mcpConfig.kubernetes.clusters,
        users: mcpConfig.kubernetes.users,
        contexts: mcpConfig.kubernetes.contexts,
        'current-context': mcpConfig.kubernetes['current-context']
      };

      // 将配置写入临时文件
      const tempConfigPath = path.join(os.tmpdir(), 'k8s-mcp-config.yaml');
      fs.writeFileSync(tempConfigPath, JSON.stringify(kubeConfig));

      kc.loadFromFile(tempConfigPath);

      // 清理临时文件
      fs.unlinkSync(tempConfigPath);

      // 验证配置
      const contexts = kc.getContexts();
      if (!contexts || contexts.length === 0) {
        throw new Error('Kubernetes 配置中没有可用的上下文');
      }

      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
      this.initialized = true;

      console.log(`成功初始化 Kubernetes 客户端，使用配置文件: ${this.configPath}`);
      console.log(`可用上下文: ${contexts.map(c => c.name).join(', ')}`);
    } catch (error) {
      console.error('初始化 Kubernetes 客户端失败:', error);
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