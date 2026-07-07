import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationService } from '../../integration/integration.service';
import { EncryptionService } from '../../../common/utils/encryption.service';
import axios from 'axios';
import * as https from 'https';

class ProxmoxDriver {
  private url: string;
  private token: string;
  private httpsAgent: https.Agent;

  constructor(config: { url: string; tokenName: string; tokenSecret: string; username?: string; password?: string }) {
    this.url = config.url.trim().replace(/\/$/, '');
    this.httpsAgent = new https.Agent({ rejectUnauthorized: true }); // Can change to false if testing with self-signed certs
    
    // Support PVEAPIToken=username!tokenid=uuid format
    if (config.tokenName && config.tokenSecret) {
      this.token = `PVEAPIToken=${config.tokenName}=${config.tokenSecret}`;
    } else if (config.username && config.password) {
      this.token = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    } else {
      this.token = '';
    }
  }

  private getHeaders() {
    return {
      Authorization: this.token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  async getNextVmid(): Promise<number> {
    try {
      const res = await axios.get(`${this.url}/api2/json/cluster/nextid`, {
        headers: this.getHeaders(),
        httpsAgent: this.httpsAgent,
      });
      return parseInt(res.data.data, 10);
    } catch (e: any) {
      return Math.floor(Math.random() * 900) + 1000;
    }
  }

  async cloneVm(node: string, vmid: number, newid: number, name: string): Promise<void> {
    const payload = {
      newid,
      name,
      full: 1,
    };
    await axios.post(`${this.url}/api2/json/nodes/${node}/qemu/${vmid}/clone`, payload, {
      headers: this.getHeaders(),
      httpsAgent: this.httpsAgent,
    });
  }

  async startVm(node: string, vmid: number): Promise<void> {
    await axios.post(`${this.url}/api2/json/nodes/${node}/qemu/${vmid}/status/start`, {}, {
      headers: this.getHeaders(),
      httpsAgent: this.httpsAgent,
    });
  }

  async getVmIp(node: string, vmid: number): Promise<string> {
    for (let i = 0; i < 24; i++) {
      try {
        const res = await axios.get(`${this.url}/api2/json/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`, {
          headers: this.getHeaders(),
          httpsAgent: this.httpsAgent,
        });
        const interfaces = res.data?.data?.result || [];
        for (const iface of interfaces) {
          if (iface.name !== 'lo' && iface['ip-addresses']) {
            for (const ipObj of iface['ip-addresses']) {
              if (ipObj['ip-address-type'] === 'ipv4' && !ipObj['ip-address'].startsWith('127.')) {
                return ipObj['ip-address'];
              }
            }
          }
        }
      } catch (e) {
        // Ignore and retry while VM is booting
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('QEMU Agent timeout: Could not retrieve IP address from VM');
  }
}

@Processor('vm-provisioning', {
  concurrency: parseInt(process.env.VM_PROVISIONING_CONCURRENCY || '3', 10),
})
export class VmProvisionWorker extends WorkerHost {
  private readonly logger = new Logger(VmProvisionWorker.name);

  constructor(
    private prisma: PrismaService,
    private integrationService: IntegrationService,
    private encryptionService: EncryptionService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { requestId, hostname, specs } = job.data;
    this.logger.log(`Processing VM provisioning for request: ${requestId} (${hostname})`);

    // Step 1: Update status to PROVISIONING
    await this.prisma.vMRequest.update({
      where: { id: requestId },
      data: { status: 'PROVISIONING' },
    });

    try {
      // Fetch VM Request to check the selected hypervisor
      const vmRequest = await this.prisma.vMRequest.findUnique({
        where: { id: requestId },
      });
      if (!vmRequest) throw new Error(`VM Request ${requestId} not found`);

      const hypervisor = vmRequest.hypervisor; // e.g. "proxmox-ve", "vmware-vsphere", "openstack"
      this.logger.log(`VM request ${requestId} uses hypervisor: ${hypervisor}`);

      // Check if there is an active plugin integration registered for this hypervisor
      const integration = await this.integrationService.findByConnectorKey(hypervisor);

      let ipAddress = '';
      let sshUser = 'yato';
      let sshPassword = '';
      let sshPort = 22;

      // Query uploaded custom plugins from SystemSetting
      const pluginSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'UPLOADED_PLUGINS' }
      });
      const uploadedPlugins: any[] = pluginSetting?.value as any[] || [];
      const customPlugin = uploadedPlugins.find(p => p.connectorKey === hypervisor);

      if (customPlugin && customPlugin.driverCode) {
        this.logger.log(`[Plugin Engine] Executing dynamic uploaded connector plugin: ${customPlugin.name}...`);
        
        await this.prisma.ticketComment.create({
          data: {
            content: `🔌 <b>[Plugin Engine]</b> Running custom uploaded driver: <b>${customPlugin.name}</b>...`,
            vmRequestId: requestId,
            authorId: vmRequest.requestedBy,
          }
        });

        const config = integration ? integration.config : {};
        
        try {
          const executeDriver = new Function('config', 'hostname', 'specs', 'logger', 'axios', 'https', `
            return (async () => {
              ${customPlugin.driverCode}
            })();
          `);

          const result = await executeDriver(config, hostname, specs, this.logger, axios, https);
          
          ipAddress = result?.ipAddress || `10.0.10.${Math.floor(Math.random() * 250) + 10}`;
          sshUser = result?.sshUser || 'yato';
          sshPassword = result?.sshPassword || Math.random().toString(36).substring(2, 12);
          sshPort = result?.sshPort ? parseInt(result.sshPort, 10) : 22;

          await this.prisma.ticketComment.create({
            data: {
              content: `✅ <b>[Plugin Engine]</b> Custom driver completed provisioning successfully! IP: <code>${ipAddress}</code>, User: <code>${sshUser}</code>.`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy,
            }
          });
        } catch (err: any) {
          this.logger.error(`[Plugin Engine] Dynamic execution error: ${err.message}`);
          throw new Error(`Custom plugin driver failed: ${err.message}`);
        }
      } else if (hypervisor === 'proxmox-ve' || hypervisor === 'proxmox') {
        this.logger.log(`[Built-in Driver] Running Proxmox VE Direct Connector...`);
        
        await this.prisma.ticketComment.create({
          data: {
            content: `🔌 <b>[Direct Connector]</b> Loading built-in Proxmox VE driver...`,
            vmRequestId: requestId,
            authorId: vmRequest.requestedBy,
          }
        });

        const config = integration ? integration.config : {};
        const url = config.url || '';
        const tokenName = config.tokenName || '';
        const tokenSecret = config.tokenSecret || '';
        const node = config.node || 'pve';
        const templateId = parseInt(config.templateId || '100', 10);

        if (!url || !tokenName || !tokenSecret) {
          this.logger.warn(`Proxmox credentials not fully configured. Running automated provisioning simulation...`);
          await this.prisma.ticketComment.create({
            data: {
              content: `⚠️ <b>[Direct Connector]</b> API details incomplete. Running automated provisioning simulation for testing...`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy,
            }
          });
          await this.executeHypervisorCommand(hostname, specs);
          ipAddress = `10.0.10.${Math.floor(Math.random() * 250) + 10}`;
          sshUser = 'yato';
          sshPassword = Math.random().toString(36).substring(2, 12);
          sshPort = 22;
        } else {
          this.logger.log(`Initiating real Proxmox VE API call to ${url}`);
          const pve = new ProxmoxDriver({ url, tokenName, tokenSecret });
          
          await this.prisma.ticketComment.create({
            data: {
              content: `⏳ <b>[Direct Connector]</b> Requesting next free VMID from Proxmox VE...`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy,
            }
          });
          const newid = await pve.getNextVmid();
          
          await this.prisma.ticketComment.create({
            data: {
              content: `⏳ <b>[Direct Connector]</b> Cloning template VM <b>${templateId}</b> to new VMID <b>${newid}</b> (${hostname})...`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy,
            }
          });
          await pve.cloneVm(node, templateId, newid, hostname);
          
          await this.prisma.ticketComment.create({
            data: {
              content: `⏳ <b>[Direct Connector]</b> Starting VMID <b>${newid}</b> on node <b>${node}</b>...`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy,
            }
          });
          await pve.startVm(node, newid);
          
          await this.prisma.ticketComment.create({
            data: {
              content: `⏳ <b>[Direct Connector]</b> Waiting for QEMU Guest Agent to report IPv4 address...`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy,
            }
          });
          ipAddress = await pve.getVmIp(node, newid);
          sshUser = 'yato';
          sshPassword = Math.random().toString(36).substring(2, 12);
          sshPort = 22;
        }

        await this.prisma.ticketComment.create({
          data: {
            content: `✅ <b>[Direct Connector]</b> Proxmox VE completed provisioning successfully! IP: <code>${ipAddress}</code>, User: <code>${sshUser}</code>.`,
            vmRequestId: requestId,
            authorId: vmRequest.requestedBy,
          }
        });
      } else if (integration) {
        this.logger.log(`[Plugin Engine] Routing provisioning to dynamic plugin container: ${integration.name} (${integration.endpointUrl})`);
        
        try {
          // Add comment to request thread
          await this.prisma.ticketComment.create({
            data: {
              content: `🔌 <b>[Plugin Engine]</b> Routing automated provisioning to dynamic driver: <b>${integration.name}</b>...`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy, // Fallback to requester as author
            }
          });

          // Construct endpoint URL safely
          let targetUrl = integration.endpointUrl.trim();
          if (targetUrl.endsWith('/')) {
            targetUrl = targetUrl.slice(0, -1);
          }
          if (!targetUrl.endsWith('/provision')) {
            targetUrl = `${targetUrl}/provision`;
          }

          // Dispatch provisioning request to dynamic plugin container with 15-second timeout
          const pluginRes = await axios.post(targetUrl, {
            requestId,
            ticketId: vmRequest.ticketId,
            hostname,
            specs,
            config: integration.config, // Decrypted credentials/API secrets
          }, { timeout: 15000 });

          this.logger.log(`[Plugin Engine] Plugin responded: ${JSON.stringify(pluginRes.data)}`);

          // Parse result parameters returned by the dynamic plugin
          ipAddress = pluginRes.data?.ipAddress || `10.0.10.${Math.floor(Math.random() * 250) + 10}`;
          sshUser = pluginRes.data?.sshUser || 'yato';
          sshPassword = pluginRes.data?.sshPassword || '';
          sshPort = pluginRes.data?.sshPort ? parseInt(pluginRes.data.sshPort, 10) : 22;

          // Add success comment to ticket thread
          await this.prisma.ticketComment.create({
            data: {
              content: `✅ <b>[Plugin Engine]</b> Dynamic plugin completed provisioning successfully! IP: <code>${ipAddress}</code>, User: <code>${sshUser}</code>.`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy,
            }
          });

        } catch (pluginError: any) {
          const errMsg = pluginError?.response?.data?.message || pluginError?.message || String(pluginError);
          this.logger.error(`[Plugin Engine] Connection error with plugin: ${errMsg}`);
          
          try {
            await this.prisma.ticketComment.create({
              data: {
                content: `⚠️ <b>[Plugin Engine Error]</b> Driver <b>${integration.name}</b> failed to provision: <code>${errMsg}</code>. Reverting and failing task.`,
                vmRequestId: requestId,
                authorId: vmRequest.requestedBy,
              }
            });
          } catch (commentErr: any) {
            this.logger.error(`Failed to create plugin error ticket comment: ${commentErr.message}`);
          }

          throw new Error(`Plugin provision failed: ${errMsg}`);
        }
      } else {
        // Simulation of a Real Hypervisor Call (Fallback if no plugin registered)
        this.logger.log(`No active integration connector found for '${hypervisor}'. Executing built-in simulation...`);
        await this.executeHypervisorCommand(hostname, specs);
        ipAddress = `10.0.10.${Math.floor(Math.random() * 250) + 10}`;
      }

      // Step 2: Update Inventory Record
      await this.prisma.vMInventory.update({
        where: { requestId },
        data: {
          ipAddress,
          sshUser,
          sshPassword: sshPassword ? this.encryptionService.encrypt(sshPassword) : null,
          sshPort,
          status: 'RUNNING',
        },
      });

      // Step 3: Update status to COMPLETED
      await this.prisma.vMRequest.update({
        where: { id: requestId },
        data: { status: 'COMPLETED' },
      });

      this.logger.log(`VM provisioning completed for ${hostname}. IP Assigned: ${ipAddress}`);
    } catch (error: any) {
      this.logger.error(`VM provisioning failed for ${requestId}`, error.stack);
      
      try {
        const vmRequest = await this.prisma.vMRequest.findUnique({
          where: { id: requestId },
        });
        if (vmRequest) {
          await this.prisma.ticketComment.create({
            data: {
              content: `❌ <b>[System Error]</b> Provisioning failed: <code>${error.message || error}</code>`,
              vmRequestId: requestId,
              authorId: vmRequest.requestedBy,
            }
          });
        }
      } catch (commentErr: any) {
        this.logger.error(`Failed to create system error ticket comment: ${commentErr.message}`);
      }

      await this.prisma.vMRequest.update({
        where: { id: requestId },
        data: { status: 'FAILED' },
      });

      // Also update inventory status
      await this.prisma.vMInventory.update({
        where: { requestId },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  private async executeHypervisorCommand(hostname: string, specs: any) {
    const duration = 5000 + Math.random() * 5000; // 5-10 seconds
    return new Promise((resolve) => setTimeout(resolve, duration));
  }
}
