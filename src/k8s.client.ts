import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as YAML from 'yaml';

export class K8sClient {
  private static instance: K8sClient;
  private k8sApi: k8s.CoreV1Api;
  private configPath: string;

  private constructor() {
    this.configPath = process.env.KUBECONFIG || `${process.env.HOME}/.kube/config`;
    this.initializeClient();
  }

  private initializeClient() {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const kubeConfig = YAML.parse(configContent);

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

  public async getPods(namespace?: string) {
    try {
      const response = namespace 
        ? await this.k8sApi.listNamespacedPod(namespace)
        : await this.k8sApi.listPodForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error getting pods:', error);
      throw error;
    }
  }

  public async describePod(name: string, namespace: string = 'default') {
    try {
      const response = await this.k8sApi.readNamespacedPod(name, namespace);
      return response.body;
    } catch (error) {
      console.error('Error describing pod:', error);
      throw error;
    }
  }

  public async getPodLogs(name: string, namespace: string = 'default', container?: string) {
    try {
      const response = await this.k8sApi.readNamespacedPodLog(
        name,
        namespace,
        container,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      return response.body;
    } catch (error) {
      console.error('Error getting pod logs:', error);
      throw error;
    }
  }
} 