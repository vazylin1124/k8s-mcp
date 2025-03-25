import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as os from 'os';

// 创建自定义日志函数
const log = {
  info: (...args: any[]) => console.error('[INFO]', ...args),
  warn: (...args: any[]) => console.error('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

export interface K8sConfig {
  apiServer: string;
  namespace: string;
}

export class K8sConfigManager {
  private static instance: K8sConfigManager;
  private config: K8sConfig;

  private constructor() {
    this.config = this.loadConfig();
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

  private loadConfig(): K8sConfig {
    try {
      // 尝试从多个位置加载配置
      const configLocations = [
        path.join(process.cwd(), 'k8s_config.yaml'),
        path.join(os.homedir(), '.kube', 'config')
      ];

      for (const configPath of configLocations) {
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const configData = yaml.parse(configContent);

          // 验证配置数据
          if (configData?.clusters?.[0]?.cluster?.server) {
            return {
              apiServer: configData.clusters[0].cluster.server,
              namespace: configData.contexts?.[0]?.context?.namespace || 'default'
            };
          }
          log.warn(`Invalid configuration in ${configPath}: missing cluster server`);
        }
      }

      // 如果没有找到有效配置，使用环境变量或默认值
      const host = process.env.KUBERNETES_SERVICE_HOST || 'localhost';
      const port = process.env.KUBERNETES_SERVICE_PORT || '8080';
      const namespace = process.env.KUBERNETES_NAMESPACE || 'default';

      log.warn('No valid Kubernetes configuration found, using default configuration');
      return {
        apiServer: `http://${host}:${port}`,
        namespace
      };
    } catch (error) {
      log.error('Error loading Kubernetes configuration:', error);
      // 返回默认配置
      return {
        apiServer: 'http://localhost:8080',
        namespace: 'default'
      };
    }
  }
} 