import { Service } from '@symph/core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@Service()
export class K8sService {
  /**
   * Check the status of Kubernetes pods using kubectl command
   */
  async checkPodStatus(params: {
    namespace?: string;
    pod_name?: string;
    selector?: string;
    kubeconfig_path?: string;
    context?: string;
    all_namespaces?: boolean;
  }): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      // Build the kubectl command
      let command = 'kubectl get pods';
      
      // Add namespace parameter
      if (params.all_namespaces) {
        command += ' --all-namespaces';
      } else if (params.namespace) {
        command += ` -n ${params.namespace}`;
      }
      
      // Add pod name if specified
      if (params.pod_name) {
        command += ` ${params.pod_name}`;
      }
      
      // Add selector if specified
      if (params.selector) {
        command += ` -l ${params.selector}`;
      }
      
      // Add kubeconfig if specified
      if (params.kubeconfig_path) {
        command += ` --kubeconfig=${params.kubeconfig_path}`;
      }
      
      // Add context if specified
      if (params.context) {
        command += ` --context=${params.context}`;
      }
      
      // Add output format for detailed information
      command += ' -o wide';
      
      try {
        // Execute the kubectl command
        const { stdout, stderr } = await execPromise(command);
        
        if (stderr && !stdout) {
          return {
            content: [{ type: 'text', text: `Error executing kubectl command: ${stderr}` }],
            isError: true
          };
        }
        
        // Format the output
        let formattedOutput = '```\n' + stdout + '\n```\n\n';
        
        // Add a summary of pod statuses
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) { // At least one pod plus the header line
          const podStatuses: Record<string, number> = {};
          const problemPods: Array<{ namespace: string; podName: string; status: string }> = [];
          
          // Skip the header line (index 0)
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const columns = line.split(/\s+/);
            
            // Pod status is typically in the 3rd column (index 2)
            let podName = columns[0];
            const status = columns[2];
            
            // Count statuses
            podStatuses[status] = (podStatuses[status] || 0) + 1;
            
            // Check for problematic pods (not Running or Completed)
            if (status !== 'Running' && status !== 'Completed') {
              let namespace = 'default';
              if (params.all_namespaces) {
                namespace = columns[0];
                // Adjust the pod name when using --all-namespaces
                podName = columns[1];
              } else if (params.namespace) {
                namespace = params.namespace;
              }
              
              problemPods.push({ namespace, podName, status });
            }
          }
          
          // Add status summary
          formattedOutput += '### Pod Status Summary\n';
          for (const [status, count] of Object.entries(podStatuses)) {
            formattedOutput += `- ${status}: ${count} pod(s)\n`;
          }
          
          // Add problem pods section if any
          if (problemPods.length > 0) {
            formattedOutput += '\n### Problem Pods\n';
            for (const pod of problemPods) {
              formattedOutput += `- Namespace: ${pod.namespace}, Pod: ${pod.podName}, Status: ${pod.status}\n`;
              
              // Get more details about problem pods
              try {
                const detailCommand = `kubectl describe pod ${pod.podName} -n ${pod.namespace}`;
                const { stdout: detailOutput } = await execPromise(detailCommand);
                
                // Extract events section which often contains error information
                const eventsMatch = detailOutput.match(/Events:(.*?)((?:\n\n)|$)/s);
                if (eventsMatch && eventsMatch[1]) {
                  formattedOutput += '\n  Recent events:\n```\n' + eventsMatch[1].trim() + '\n```\n';
                }
              } catch (detailError) {
                formattedOutput += `\n  Could not get pod details: ${detailError.message}\n`;
              }
            }
          }
        }
        
        return {
          content: [{ type: 'text', text: formattedOutput }]
        };
      } catch (error: any) {
        // Check if it's a command not found error
        if (error.message.includes('command not found')) {
          return {
            content: [{ type: 'text', text: 'Error: kubectl command not found. Please make sure kubectl is installed and in your PATH.' }],
            isError: true
          };
        }
        
        // Other execution errors
        return {
          content: [{ type: 'text', text: `Error executing kubectl command: ${error.message}` }],
          isError: true
        };
      }
    } catch (error: any) {
      console.error('Error in checkPodStatus:', error);
      return {
        content: [{ type: 'text', text: `Error checking pod status: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get detailed information about a specific Kubernetes pod
   */
  async describePod(params: {
    namespace?: string;
    pod_name: string;
    kubeconfig_path?: string;
    context?: string;
  }): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      // Build the kubectl command
      let command = `kubectl describe pod ${params.pod_name}`;
      
      // Add namespace parameter if specified
      if (params.namespace) {
        command += ` -n ${params.namespace}`;
      }
      
      // Add kubeconfig if specified
      if (params.kubeconfig_path) {
        command += ` --kubeconfig=${params.kubeconfig_path}`;
      }
      
      // Add context if specified
      if (params.context) {
        command += ` --context=${params.context}`;
      }
      
      try {
        // Execute the kubectl command
        const { stdout, stderr } = await execPromise(command);
        
        if (stderr && !stdout) {
          return {
            content: [{ type: 'text', text: `Error describing pod: ${stderr}` }],
            isError: true
          };
        }
        
        // Format the output with markdown code block
        const formattedOutput = '```\n' + stdout + '\n```';
        
        return {
          content: [{ type: 'text', text: formattedOutput }]
        };
      } catch (error: any) {
        // Check if it's a command not found error
        if (error.message.includes('command not found')) {
          return {
            content: [{ type: 'text', text: 'Error: kubectl command not found. Please make sure kubectl is installed and in your PATH.' }],
            isError: true
          };
        }
        
        // Other execution errors
        return {
          content: [{ type: 'text', text: `Error executing kubectl command: ${error.message}` }],
          isError: true
        };
      }
    } catch (error: any) {
      console.error('Error in describePod:', error);
      return {
        content: [{ type: 'text', text: `Error describing pod: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Retrieve logs from a Kubernetes pod
   */
  async getPodLogs(params: {
    namespace?: string;
    pod_name: string;
    container?: string;
    tail_lines?: number;
    previous?: boolean;
    kubeconfig_path?: string;
    context?: string;
  }): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      // Build the kubectl command
      let command = `kubectl logs ${params.pod_name}`;
      
      // Add namespace parameter if specified
      if (params.namespace) {
        command += ` -n ${params.namespace}`;
      }
      
      // Add container parameter if specified
      if (params.container) {
        command += ` -c ${params.container}`;
      }
      
      // Add tail lines parameter if specified
      if (params.tail_lines) {
        command += ` --tail=${params.tail_lines}`;
      }
      
      // Add previous parameter if specified
      if (params.previous) {
        command += ' -p';
      }
      
      // Add kubeconfig if specified
      if (params.kubeconfig_path) {
        command += ` --kubeconfig=${params.kubeconfig_path}`;
      }
      
      // Add context if specified
      if (params.context) {
        command += ` --context=${params.context}`;
      }
      
      try {
        // Execute the kubectl command
        const { stdout, stderr } = await execPromise(command);
        
        if (stderr && !stdout) {
          return {
            content: [{ type: 'text', text: `Error retrieving pod logs: ${stderr}` }],
            isError: true
          };
        }
        
        // Check if logs are empty
        if (!stdout.trim()) {
          return {
            content: [{ type: 'text', text: 'No logs available for the specified pod/container.' }]
          };
        }
        
        // Format the output with markdown code block
        const formattedOutput = '```\n' + stdout + '\n```';
        
        return {
          content: [{ type: 'text', text: formattedOutput }]
        };
      } catch (error: any) {
        // Check if it's a command not found error
        if (error.message.includes('command not found')) {
          return {
            content: [{ type: 'text', text: 'Error: kubectl command not found. Please make sure kubectl is installed and in your PATH.' }],
            isError: true
          };
        }
        
        // Other execution errors
        return {
          content: [{ type: 'text', text: `Error executing kubectl command: ${error.message}` }],
          isError: true
        };
      }
    } catch (error: any) {
      console.error('Error in getPodLogs:', error);
      return {
        content: [{ type: 'text', text: `Error retrieving pod logs: ${error.message}` }],
        isError: true
      };
    }
  }
} 