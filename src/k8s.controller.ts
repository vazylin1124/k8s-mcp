import { Controller, Get, Post, Body, Inject } from '@symph/core';
import { K8sService } from './k8s.service';

@Controller('/api/k8s')
export class K8sController {
  @Inject()
  private k8sService: K8sService;

  @Post('/pods/status')
  async checkPodStatus(@Body() params: {
    namespace?: string;
    pod_name?: string;
    selector?: string;
    kubeconfig_path?: string;
    context?: string;
    all_namespaces?: boolean;
  }) {
    return this.k8sService.checkPodStatus(params);
  }

  @Post('/pods/describe')
  async describePod(@Body() params: {
    namespace?: string;
    pod_name: string;
    kubeconfig_path?: string;
    context?: string;
  }) {
    return this.k8sService.describePod(params);
  }

  @Post('/pods/logs')
  async getPodLogs(@Body() params: {
    namespace?: string;
    pod_name: string;
    container?: string;
    tail_lines?: number;
    previous?: boolean;
    kubeconfig_path?: string;
    context?: string;
  }) {
    return this.k8sService.getPodLogs(params);
  }
} 