import * as k8s from '@kubernetes/client-node';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { parse, stringify } from 'yaml';
import { K8sConfigManager } from './k8s.config';
import { MockK8sClient } from './k8s.mock';
import { MCPConfig } from '../types/mcp.config';
import { log } from '../utils/logger';

export class K8sClient {
  private static instance: K8sClient;
  private k8sApi!: k8s.CoreV1Api;
  private configPath: string;
  private initialized: boolean = false;
  private mockClient: MockK8sClient;
  private useMock: boolean = false;

  private constructor() {
    this.configPath = join(process.cwd(), 'k8s_config.yaml');
    this.mockClient = MockK8sClient.getInstance();
    log.info(`Using kubeconfig path: ${this.configPath}`);
  }

  private async initializeClient(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const kc = new k8s.KubeConfig();
      
      // 尝试直接加载配置文件
      try {
        log.info('Attempting to load kubeconfig from:', this.configPath);
        kc.loadFromFile(this.configPath);
        
        // 打印集群配置信息
        const clusters = kc.getClusters();
        log.info('Loaded clusters:', JSON.stringify(clusters, null, 2));
        
        const contexts = kc.getContexts();
        log.info('Loaded contexts:', JSON.stringify(contexts, null, 2));
        
        const users = kc.getUsers();
        log.info('Loaded users:', JSON.stringify(users, null, 2));

        this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        
        // 测试连接
        log.info('Testing connection to Kubernetes cluster...');
        const version = await this.k8sApi.getAPIResources();
        log.info('API Resources:', JSON.stringify(version.body, null, 2));
        
        this.initialized = true;
        log.info('Successfully initialized Kubernetes client from config file');
        return;
      } catch (error: any) {
        log.warn(`Failed to load from config file: ${error.message}`);
        if (error.response) {
          log.warn('API Response:', JSON.stringify(error.response.body, null, 2));
        }
        throw error;
      }
    } catch (error: any) {
      log.warn(`Failed to initialize Kubernetes client, using mock client: ${error.message}`);
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
      log.info('Using mock client for getPods');
      return this.mockClient.getPods(namespace);
    }
    try {
      log.info(`Fetching pods${namespace ? ` in namespace ${namespace}` : ' in all namespaces'}`);
      if (namespace) {
        const response = await this.k8sApi.listNamespacedPod(namespace);
        return response.body;
      } else {
        const response = await this.k8sApi.listPodForAllNamespaces();
        return response.body;
      }
    } catch (error: any) {
      log.error(`Error getting pods: ${error.message}`);
      log.info('Falling back to mock client');
      return this.mockClient.getPods(namespace);
    }
  }

  public async describePod(name: string, namespace: string = 'default'): Promise<k8s.V1Pod> {
    await this.initializeClient();
    if (this.useMock) {
      log.info('Using mock client for describePod');
      return this.mockClient.describePod(name, namespace);
    }
    try {
      log.info(`Describing pod ${name} in namespace ${namespace}`);
      const response = await this.k8sApi.readNamespacedPod(name, namespace);
      return response.body;
    } catch (error: any) {
      log.error(`Error describing pod: ${error.message}`);
      log.info('Falling back to mock client');
      return this.mockClient.describePod(name, namespace);
    }
  }

  public async getPodLogs(name: string, namespace: string = 'default', container?: string): Promise<string> {
    await this.initializeClient();
    if (this.useMock) {
      log.info('Using mock client for getPodLogs');
      return this.mockClient.getPodLogs(name, namespace, container);
    }
    try {
      log.info(`Getting logs for pod ${name} in namespace ${namespace}${container ? ` container ${container}` : ''}`);
      const response = await this.k8sApi.readNamespacedPodLog(name, namespace, container);
      return response.body;
    } catch (error: any) {
      log.error(`Error getting pod logs: ${error.message}`);
      log.info('Falling back to mock client');
      return this.mockClient.getPodLogs(name, namespace, container);
    }
  }
}