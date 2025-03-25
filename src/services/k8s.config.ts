import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import { log } from '../utils/logger';

export interface K8sConfig {
  apiServer: string;
  namespace: string;
}

export class K8sConfigManager {
  private static instance: K8sConfigManager;
  private config: K8sConfig;

  private constructor() {
    // 默认配置
    const defaultConfig: K8sConfig = {
      apiServer: 'http://localhost:8080',
      namespace: 'default'
    };

    // 检查是否在 Smithery 模式下运行
    const isSmithery = process.env.SMITHERY === 'true';

    if (isSmithery) {
      // Smithery 模式下使用默认配置
      this.config = defaultConfig;
      log.info('Running in Smithery mode, using default configuration');
      return;
    }

    try {
      // 尝试从配置文件加载
      const configPath = join(process.cwd(), 'k8s_config.yaml');
      
      // 如果配置文件不存在，创建默认配置文件
      if (!existsSync(configPath)) {
        log.warn('k8s_config.yaml not found, creating default configuration file');
        writeFileSync(configPath, stringify({
          apiVersion: 'v1',
          kind: 'Config',
          clusters: [{
            name: 'default',
            cluster: {
              server: defaultConfig.apiServer,
              'insecure-skip-tls-verify': true
            }
          }],
          contexts: [{
            name: 'default',
            context: {
              cluster: 'default',
              namespace: defaultConfig.namespace
            }
          }],
          'current-context': 'default',
          preferences: {},
          users: []
        }));
      }

      const configData = parse(readFileSync(configPath, 'utf8'));
      
      // 验证配置
      if (!configData || typeof configData !== 'object') {
        throw new Error('Invalid kubernetes configuration: not a valid YAML object');
      }

      if (!configData.clusters || !Array.isArray(configData.clusters) || configData.clusters.length === 0) {
        throw new Error('Invalid kubernetes configuration: clusters array is empty or missing');
      }

      const cluster = configData.clusters[0].cluster;
      if (!cluster || typeof cluster !== 'object') {
        throw new Error('Invalid kubernetes configuration: first cluster is invalid');
      }

      if (!cluster.server || typeof cluster.server !== 'string') {
        throw new Error('Invalid kubernetes configuration: server URL is missing or invalid');
      }

      let namespace = defaultConfig.namespace;
      if (configData.contexts && Array.isArray(configData.contexts) && configData.contexts.length > 0) {
        const context = configData.contexts[0].context;
        if (context && typeof context === 'object' && typeof context.namespace === 'string') {
          namespace = context.namespace;
        }
      }

      this.config = {
        apiServer: cluster.server,
        namespace: namespace
      };

      log.info('Loaded kubernetes configuration:', JSON.stringify(this.config));
    } catch (error: any) {
      log.warn(`Failed to load kubernetes config, using default: ${error.message}`);
      this.config = defaultConfig;
    }
  }

  public static getInstance(): K8sConfigManager {
    if (!K8sConfigManager.instance) {
      K8sConfigManager.instance = new K8sConfigManager();
    }
    return K8sConfigManager.instance;
  }

  public getConfig(): K8sConfig {
    return this.config;
  }
}