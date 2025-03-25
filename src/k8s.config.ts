import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';

// 创建自定义日志函数，使用标准错误输出
const log = {
  info: (...args: any[]) => process.stderr.write(`[INFO] ${args.join(' ')}\n`),
  warn: (...args: any[]) => process.stderr.write(`[WARN] ${args.join(' ')}\n`),
  error: (...args: any[]) => process.stderr.write(`[ERROR] ${args.join(' ')}\n`)
};

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
      apiServer: 'https://kubernetes.default.svc',
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
          preferences: {}
        }));
      }

      const configData = parse(readFileSync(configPath, 'utf8'));
      
      // 验证配置
      if (!configData?.clusters?.[0]?.cluster?.server) {
        throw new Error('Invalid kubernetes configuration: missing server');
      }

      this.config = {
        apiServer: configData.clusters[0].cluster.server,
        namespace: configData.contexts?.[0]?.context?.namespace || defaultConfig.namespace
      };

      log.info('Loaded kubernetes configuration:', JSON.stringify(this.config));
    } catch (error) {
      log.warn('Failed to load kubernetes config, using default:', error);
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