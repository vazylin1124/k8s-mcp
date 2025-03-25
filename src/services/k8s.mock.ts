import { V1Pod, V1PodList } from '@kubernetes/client-node';

export class MockK8sClient {
  private static instance: MockK8sClient;

  private constructor() {}

  public static getInstance(): MockK8sClient {
    if (!MockK8sClient.instance) {
      MockK8sClient.instance = new MockK8sClient();
    }
    return MockK8sClient.instance;
  }

  public async getPods(_namespace?: string): Promise<V1PodList> {
    const now = new Date();
    return {
      kind: 'PodList',
      apiVersion: 'v1',
      metadata: {
        resourceVersion: '1',
      },
      items: [
        {
          metadata: {
            name: 'mock-pod',
            namespace: 'default',
            creationTimestamp: now,
          },
          spec: {
            containers: [
              {
                name: 'mock-container',
                image: 'mock-image:latest',
              },
            ],
          },
          status: {
            phase: 'Running',
            containerStatuses: [
              {
                name: 'mock-container',
                ready: true,
                restartCount: 0,
                state: {
                  running: {
                    startedAt: now,
                  },
                },
              },
            ],
            podIP: '10.0.0.1',
          },
        } as V1Pod,
      ],
    };
  }

  public async describePod(name: string, namespace: string = 'default'): Promise<V1Pod> {
    const now = new Date();
    return {
      metadata: {
        name,
        namespace,
        creationTimestamp: now,
      },
      spec: {
        containers: [
          {
            name: 'mock-container',
            image: 'mock-image:latest',
          },
        ],
      },
      status: {
        phase: 'Running',
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            lastTransitionTime: now,
            reason: 'MockReady',
            message: 'Mock pod is ready',
          },
        ],
        containerStatuses: [
          {
            name: 'mock-container',
            ready: true,
            restartCount: 0,
            state: {
              running: {
                startedAt: now,
              },
            },
          },
        ],
        podIP: '10.0.0.1',
      },
    } as V1Pod;
  }

  public async getPodLogs(_name: string, _namespace: string = 'default', _container?: string): Promise<string> {
    return 'Mock pod logs\nThis is a simulated log output\nEverything is running fine';
  }
} 