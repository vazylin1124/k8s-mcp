import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

export class K8sClient {
  private static instance: K8sClient;
  private k8sApi!: k8s.CoreV1Api;
  private configPath: string;

  private constructor() {
    // 设置配置文件路径为当前目录下的 k8s_config.yaml
    this.configPath = path.join(process.cwd(), 'k8s_config.yaml');
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Kubernetes 配置文件不存在: ${this.configPath}`);
      }

      const kc = new k8s.KubeConfig();
      kc.loadFromFile(this.configPath);

      // 验证配置
      const contexts = kc.getContexts();
      if (!contexts || contexts.length === 0) {
        throw new Error('Kubernetes 配置文件中没有可用的上下文');
      }

      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
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
    try {
      if (namespace) {
        const response = await this.k8sApi.listNamespacedPod(namespace) as any;
        return response.body;
      } else {
        const response = await this.k8sApi.listPodForAllNamespaces() as any;
        return response.body;
      }
    } catch (error) {
      console.error('Error getting pods:', error);
      throw error;
    }
  }

  public async describePod(name: string, namespace: string = 'default'): Promise<k8s.V1Pod> {
    try {
      const response = await this.k8sApi.readNamespacedPod(name, namespace) as any;
      return response.body;
    } catch (error) {
      console.error('Error describing pod:', error);
      throw error;
    }
  }

  public async getPodLogs(name: string, namespace: string = 'default', container?: string): Promise<string> {
    try {
      const response = await this.k8sApi.readNamespacedPodLog(name, namespace) as any;
      return response.body;
    } catch (error) {
      console.error('Error getting pod logs:', error);
      throw error;
    }
  }
}