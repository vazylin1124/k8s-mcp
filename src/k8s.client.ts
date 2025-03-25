import * as https from 'https';
import { K8sConfigManager } from './k8s.config';

export class K8sClient {
  private static instance: K8sClient;
  private config = K8sConfigManager.getInstance().getConfig();

  private constructor() {}

  public static getInstance(): K8sClient {
    if (!K8sClient.instance) {
      K8sClient.instance = new K8sClient();
    }
    return K8sClient.instance;
  }

  private createHttpsAgent(): https.Agent {
    return new https.Agent({
      cert: this.config.clientCertificate,
      key: this.config.clientKey,
      ca: this.config.certificateAuthority,
      rejectUnauthorized: false // 在生产环境中应该设置为 true
    });
  }

  public async request(path: string, namespace?: string): Promise<any> {
    const agent = this.createHttpsAgent();
    const url = namespace 
      ? `${this.config.apiServer}/api/v1/namespaces/${namespace}${path}`
      : `${this.config.apiServer}/api/v1${path}`;

    return new Promise((resolve, reject) => {
      const req = https.get(url, { agent }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  public async getPods(namespace?: string): Promise<any> {
    const path = '/pods';
    return this.request(path, namespace);
  }

  public async getPodLogs(podName: string, namespace: string = 'default', container?: string): Promise<string> {
    const path = `/namespaces/${namespace}/pods/${podName}/log${container ? `?container=${container}` : ''}`;
    const url = `${this.config.apiServer}/api/v1${path}`;
    const agent = this.createHttpsAgent();

    return new Promise((resolve, reject) => {
      const req = https.get(url, { agent }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  public async describePod(podName: string, namespace: string = 'default'): Promise<any> {
    const path = `/pods/${podName}`;
    return this.request(path, namespace);
  }
} 