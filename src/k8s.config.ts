import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

export interface K8sConfig {
  apiServer: string;
  certificateAuthority: string;
  clientCertificate: string;
  clientKey: string;
}

export class K8sConfigManager {
  private static instance: K8sConfigManager;
  private config: K8sConfig;

  private constructor() {
    try {
      const configPath = path.join(process.cwd(), 'k8s_config.yaml');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const kubeConfig = YAML.parse(configContent);
      
      if (!kubeConfig || !kubeConfig.clusters || !kubeConfig.clusters[0] || !kubeConfig.clusters[0].cluster) {
        throw new Error('Invalid kubeconfig format: missing clusters configuration');
      }

      if (!kubeConfig.users || !kubeConfig.users[0] || !kubeConfig.users[0].user) {
        throw new Error('Invalid kubeconfig format: missing users configuration');
      }

      this.config = {
        apiServer: kubeConfig.clusters[0].cluster.server,
        certificateAuthority: Buffer.from(kubeConfig.clusters[0].cluster['certificate-authority-data'], 'base64').toString(),
        clientCertificate: Buffer.from(kubeConfig.users[0].user['client-certificate-data'], 'base64').toString(),
        clientKey: Buffer.from(kubeConfig.users[0].user['client-key-data'], 'base64').toString(),
      };
    } catch (error) {
      console.error('Error loading k8s config:', error);
      throw error;
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