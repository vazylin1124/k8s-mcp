import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as YAML from 'yaml';

export class K8sClient {
  private static instance: K8sClient;
  private k8sApi!: k8s.CoreV1Api;
  private configPath: string;

  private constructor() {
    this.configPath = process.env.KUBECONFIG || `${process.env.HOME}/.kube/config`;
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromFile(this.configPath);
      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    } catch (error) {
      console.error('Error initializing K8s client:', error);
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
        const opts = { namespace } as k8s.CoreV1ApiListNamespacedPodRequest;
        const response = await this.k8sApi.listNamespacedPod(opts);
        return (response as any).body;
      } else {
        const response = await this.k8sApi.listPodForAllNamespaces();
        return (response as any).body;
      }
    } catch (error) {
      console.error('Error getting pods:', error);
      throw error;
    }
  }

  public async describePod(name: string, namespace: string = 'default'): Promise<k8s.V1Pod> {
    try {
      const opts = { name, namespace } as k8s.CoreV1ApiReadNamespacedPodRequest;
      const response = await this.k8sApi.readNamespacedPod(opts);
      return (response as any).body;
    } catch (error) {
      console.error('Error describing pod:', error);
      throw error;
    }
  }

  public async getPodLogs(name: string, namespace: string = 'default', container?: string): Promise<string> {
    try {
      const opts = { name, namespace, container } as k8s.CoreV1ApiReadNamespacedPodLogRequest;
      const response = await this.k8sApi.readNamespacedPodLog(opts);
      return (response as any).body;
    } catch (error) {
      console.error('Error getting pod logs:', error);
      throw error;
    }
  }
} 