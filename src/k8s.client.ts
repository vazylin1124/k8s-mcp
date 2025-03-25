import * as k8s from '@kubernetes/client-node';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { parse, stringify } from 'yaml';
import { K8sConfigManager } from './k8s.config.js';
import { MockK8sClient } from './k8s.mock.js';
import { MCPConfig } from './types/mcp.config.js';

// 创建自定义日志函数，使用标准错误输出
const log = {
  info: (...args: any[]) => process.stderr.write(`[INFO] ${args.join(' ')}\n`),
  warn: (...args: any[]) => process.stderr.write(`[WARN] ${args.join(' ')}\n`),
  error: (...args: any[]) => process.stderr.write(`[ERROR] ${args.join(' ')}\n`)
};

export class K8sClient {
  private static instance: K8sClient;
  private k8sApi!: k8s.CoreV1Api;
  private configPath: string;
  private initialized: boolean = false;
  private mockClient: MockK8sClient;
  private useMock: boolean = false;

  private constructor() {
    this.configPath = join(homedir(), '.cursor', 'mcp.json');
    this.mockClient = MockK8sClient.getInstance();
  }

  private async initializeClient(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const kc = new k8s.KubeConfig();
      const configManager = K8sConfigManager.getInstance();
      const config = configManager.getConfig();
      
      // 创建临时 kubeconfig
      const tempConfig = {
        apiVersion: 'v1',
        kind: 'Config',
        clusters: [{
          name: 'default',
          cluster: {
            server: config.apiServer,
            'insecure-skip-tls-verify': true
          }
        }],
        contexts: [{
          name: 'default',
          context: {
            cluster: 'default',
            namespace: config.namespace
          }
        }],
        'current-context': 'default',
        preferences: {},
        users: []
      };

      const tempConfigPath = join(tmpdir(), 'k8s-mcp-config.yaml');
      writeFileSync(tempConfigPath, stringify(tempConfig));
      
      try {
        kc.loadFromFile(tempConfigPath);
        this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        this.initialized = true;
        log.info('Successfully initialized Kubernetes client');
        log.info(`Using API server: ${config.apiServer}`);
        log.info(`Using namespace: ${config.namespace}`);
      } catch (error) {
        log.warn('Failed to initialize Kubernetes client, using mock client:', error);
        this.useMock = true;
      } finally {
        // 清理临时文件
        unlinkSync(tempConfigPath);
      }
    } catch (error) {
      log.warn('Failed to initialize Kubernetes client, using mock client:', error);
      this.useMock = true;
    }
    
    this.initialized = true;
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
        const response = await this.k8sApi.listNamespacedPod(namespace);
        return response.body;
      } else {
        const response = await this.k8sApi.listPodForAllNamespaces();
        return response.body;
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
      const response = await this.k8sApi.readNamespacedPod(name, namespace);
      return response.body;
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
      const response = await this.k8sApi.readNamespacedPodLog(name, namespace, container);
      return response.body;
    } catch (error) {
      log.error('Error getting pod logs:', error);
      return this.mockClient.getPodLogs(name, namespace, container);
    }
  }
}