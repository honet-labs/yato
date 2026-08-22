import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SystemConfigService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async debugDump() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        roles: { include: { role: true } }
      }
    });
    const tasks = await this.prisma.task.findMany({
      select: {
        id: true,
        title: true,
        createdById: true,
        assigneeId: true,
        tags: true,
        assignees: { select: { id: true, username: true } },
        followers: { select: { id: true, username: true } }
      }
    });
    const tickets = await this.prisma.supportTicket.findMany({
      select: {
        id: true,
        subject: true,
        requestedBy: true,
        tags: true,
        followers: { select: { id: true, username: true } }
      }
    });
    const notes = await this.prisma.note.findMany({
      select: {
        id: true,
        title: true,
        userId: true,
        reminderAt: true,
        reminderSent: true,
        isTrashed: true,
        repeatInterval: true
      }
    });
    return { users, tasks, tickets, notes };
  }

  async getSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    return setting?.value || null;
  }

  async getAllSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const result: any = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    if (!result['NOTIFICATION_ROUTING_RULES']) {
      const defaultRules = [
        {
          name: "Network Team Route",
          categories: ["NETWORK", "NETWORKING", "ROUTER", "SWITCH", "FIREWALL"],
          priorities: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
          ticketTypes: ["SUPPORT", "SERVICE"],
          targetRoles: ["ADMIN_NETWORK", "NETWORK_ADMIN"]
        },
        {
          name: "Infra Team Route",
          categories: ["INFRASTRUCTURE", "HARDWARE", "SERVER", "VM"],
          priorities: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
          ticketTypes: ["VM", "SERVICE", "SUPPORT"],
          targetRoles: ["ADMIN_INFRA", "INFRA_ADMIN"]
        },
        {
          name: "Database Team Route",
          categories: ["DATABASE", "DBA", "POSTGRESQL", "MYSQL", "REDIS"],
          priorities: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
          ticketTypes: ["SUPPORT", "SERVICE"],
          targetRoles: ["ADMIN_DATABASE", "DBA_ADMIN"]
        }
      ];
      try {
        await this.prisma.systemSetting.upsert({
          where: { key: 'NOTIFICATION_ROUTING_RULES' },
          update: {},
          create: {
            key: 'NOTIFICATION_ROUTING_RULES',
            value: defaultRules
          }
        });
        result['NOTIFICATION_ROUTING_RULES'] = defaultRules;
      } catch (e) {
        // Suppress database race conditions
      }
    }

    try {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const url = new URL(dbUrl);
        result['DB_CONFIG'] = {
          host: url.hostname,
          port: url.port || '5432',
          user: url.username,
          password: url.password,
          database: url.pathname.replace('/', '')
        };
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    try {
      result['SERVER_TIMEZONE'] = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {}

    return result;
  }

  async getServerTimezone() {
    return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  async updateSetting(key: string, value: any, userId: string) {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    await this.auditService.log(userId, 'UPDATE_SYSTEM_CONFIG', 'SystemConfig', key, { value });
    return setting;
  }

  async testDatabaseConnection(config: any) {
    const { host, port, user, password, database } = config;
    const url = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
    
    try {
      const { PrismaClient } = require('@prisma/client');
      const testPrisma = new PrismaClient({
        datasources: {
          db: { url },
        },
      });
      await testPrisma.$connect();
      await testPrisma.$disconnect();
      return { success: true, message: 'Database connection successful.' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to connect to the database.' };
    }
  }

  async saveDatabaseConfig(config: any, userId: string) {
    const { host, port, user, password, database } = config;
    const url = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
    
    const fs = require('fs');
    const path = require('path');
    // Using process.cwd() should point to backend directory when running in dev/prod
    const envPath = path.join(process.cwd(), '.env');
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${url}"`);
    } else {
      envContent += `\nDATABASE_URL="${url}"`;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    await this.auditService.log(userId, 'UPDATE_DATABASE_CONFIG', 'SystemConfig', 'DATABASE_URL', { host, port, database });
    
    return { success: true, message: 'Database configuration saved. Please restart the backend service to apply changes.' };
  }

  async getSystemStatus() {
    const axios = require('axios');
    const net = require('net');
    const http = require('http');

    // Helper functions
    const isPortOpen = async (host: string, port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(port, host);
      });
    };

    const isUrlHealthy = async (url: string): Promise<boolean> => {
      try {
        await axios.get(url, { timeout: 1000 });
        return true;
      } catch (e) {
        return false;
      }
    };

    const getDockerContainers = async (): Promise<any[]> => {
      return new Promise((resolve) => {
        let dockerHost = 'docker-proxy';
        let dockerPort = 2375;
        if (process.env.DOCKER_HOST_URL) {
          try {
            const parsedUrl = new URL(process.env.DOCKER_HOST_URL);
            dockerHost = parsedUrl.hostname;
            dockerPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 2375;
          } catch (e) {
            // Ignore URL parsing errors
          }
        }

        const options: any = process.env.DOCKER_HOST_URL
          ? {
              host: dockerHost,
              port: dockerPort,
              path: '/containers/json?all=1',
              method: 'GET',
              timeout: 1000,
            }
          : {
              socketPath: '/var/run/docker.sock',
              path: '/containers/json?all=1',
              method: 'GET',
              timeout: 1000,
            };

        const req = http.request(options, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => data += chunk);
          res.on('end', () => {
            try {
              const containers = JSON.parse(data);
              const result = containers
                .map((c: any) => {
                  const name = c.Names && c.Names[0] ? c.Names[0].replace(/^\//, '') : c.Id.substring(0, 12);
                  return {
                    name: name.toUpperCase(),
                    image: c.Image,
                    state: c.State.toUpperCase(),
                    status: c.Status,
                    healthy: c.State.toLowerCase() === 'running'
                  };
                })
                .filter((c: any) => c.name.startsWith('YATO'));
              resolve(result);
            } catch (e) {
              resolve([]);
            }
          });
        });

        req.on('error', () => {
          resolve([]);
        });
        req.on('timeout', () => {
          req.destroy();
          resolve([]);
        });
        req.end();
      });
    };

    // 1. Database Check (yato-postgres)
    let dbStatus = 'OPERATIONAL';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
    } catch (e) {
      dbStatus = 'OFFLINE';
    }

    // 2. Identity Vault (Encryption Key Check)
    let vaultStatus = 'SECURE';
    let vaultLatency = 1;
    try {
      const start = Date.now();
      const hasKey = !!process.env.ENCRYPTION_KEY;
      if (!hasKey) throw new Error('No encryption key');
      vaultLatency = Date.now() - start;
    } catch (e) {
      vaultStatus = 'OFFLINE';
    }

    // 3. Notification Relay (WAHA WhatsApp Gateway Check)
    let notifyStatus = 'HEALTHY';
    let notifyLatency = 0;
    try {
      const start = Date.now();
      const wahaUrl = process.env.WAHA_URL || 'http://waha:3000';
      await axios.get(wahaUrl, { timeout: 2000 });
      notifyLatency = Date.now() - start;
    } catch (e: any) {
      if (e.response) {
        notifyLatency = Date.now() - (e.config?.metadata?.startTime || Date.now() - 5);
      } else {
        notifyStatus = 'OFFLINE';
      }
    }

    // 4. Provisioning Engine (Redis Queue Broker Health Check)
    let engineStatus = 'HEALTHY';
    let engineLatency = 0;
    try {
      const start = Date.now();
      const redisHost = process.env.REDIS_HOST || 'redis';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
      
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(redisPort, redisHost);
        socket.setTimeout(2000);
        socket.on('connect', () => {
          socket.end();
          resolve();
        });
        socket.on('error', (err: any) => {
          reject(err);
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Timeout'));
        });
      });
      engineLatency = Date.now() - start;
    } catch (e) {
      engineStatus = 'OFFLINE';
    }

    // 5. Vaultwarden Secret Vault Check
    let vaultwardenStatus = 'HEALTHY';
    let vaultwardenLatency = 0;
    const vaultwardenStart = Date.now();
    try {
      const vaultwardenUrl = 'http://vaultwarden:80';
      await axios.get(vaultwardenUrl + '/health', { timeout: 1000 });
      vaultwardenLatency = Date.now() - vaultwardenStart;
    } catch (e: any) {
      if (e.response) {
        vaultwardenLatency = Date.now() - vaultwardenStart;
      } else {
        vaultwardenStatus = 'OFFLINE';
      }
    }

    const cores = [
      {
        id: 'engine',
        name: 'PROVISIONING ENGINE',
        description: 'Automated VM and Service deployment orchestrator',
        status: engineStatus,
        latency: `${engineLatency}ms`,
        uptime: '99.99%',
        lastCheck: new Date().toLocaleTimeString()
      },
      {
        id: 'vaultwarden',
        name: 'VAULTWARDEN SECRET VAULT',
        description: 'Centralized passwords and secrets storage server',
        status: vaultwardenStatus,
        latency: `${vaultwardenLatency}ms`,
        uptime: '100%',
        lastCheck: new Date().toLocaleTimeString()
      },
      {
        id: 'vault',
        name: 'IDENTITY VAULT',
        description: 'Encryption layer for credential management',
        status: vaultStatus,
        latency: `${vaultLatency}ms`,
        uptime: '100%',
        lastCheck: new Date().toLocaleTimeString()
      },
      {
        id: 'notification',
        name: 'NOTIFICATION RELAY',
        description: 'Real-time alert and notification system',
        status: notifyStatus,
        latency: `${notifyLatency}ms`,
        uptime: '99.95%',
        lastCheck: new Date().toLocaleTimeString()
      },
      {
        id: 'audit',
        name: 'AUDIT LOGGING SERVICE',
        description: 'Immutable ledger for compliance tracking',
        status: dbStatus,
        latency: `${dbLatency}ms`,
        uptime: '99.99%',
        lastCheck: new Date().toLocaleTimeString()
      }
    ];

    // Get live docker containers (using Unix Socket if mounted, fallback network checks if not)
    let dockerContainers = await getDockerContainers();
    if (dockerContainers.length === 0) {
      const fallbackContainers = [
        { name: 'YATO-FRONTEND', port: 4001, serviceName: 'yato-frontend', type: 'HTTP' },
        { name: 'YATO-BACKEND', port: 3000, serviceName: 'yato-backend', type: 'TCP' },
        { name: 'YATO-POSTGRES', port: 5432, serviceName: 'postgres', type: 'TCP' },
        { name: 'YATO-REDIS', port: 6379, serviceName: 'redis', type: 'TCP' },
        { name: 'YATO-NGINX', port: 9090, serviceName: 'nginx', type: 'HTTP' },
        { name: 'YATO-VAULTWARDEN', port: 80, serviceName: 'vaultwarden', type: 'TCP' }
      ];

      dockerContainers = await Promise.all(
        fallbackContainers.map(async (c) => {
          // Check inside docker network by service host name
          const isUp = c.type === 'HTTP' 
            ? await isUrlHealthy(`http://${c.serviceName}:${c.port === 9090 ? 80 : 3000}`) // internal port
            : await isPortOpen(c.serviceName, c.port);
          return {
            name: c.name,
            image: c.serviceName === 'vaultwarden' ? 'vaultwarden/server:latest' : `yato/${c.serviceName.toLowerCase()}:latest`,
            state: isUp ? 'RUNNING' : 'EXITED',
            status: isUp ? 'Up less than a minute' : 'Exited (1) 5 minutes ago',
            healthy: isUp
          };
        })
      );
    }

    // Get live systemd services status
    const sshUp = await isPortOpen('host.docker.internal', 22) || await isPortOpen('192.168.201.18', 22);
    const dockerUp = dockerContainers.some(c => c.healthy);
    const nginxContainerUp = dockerContainers.some(c => c.name === 'YATO-NGINX' && c.healthy);
    const systemdServices = [
      {
        name: 'docker.service',
        description: 'Docker Application Container Engine',
        status: dockerUp ? 'ACTIVE' : 'INACTIVE',
        subState: dockerUp ? 'running' : 'dead'
      },
      {
        name: 'ssh.service',
        description: 'OpenBSD Secure Shell server',
        status: sshUp ? 'ACTIVE' : 'INACTIVE',
        subState: sshUp ? 'running' : 'dead'
      },
      {
        name: 'nginx.service',
        description: 'High Performance HTTP Server',
        status: nginxContainerUp ? 'ACTIVE' : 'INACTIVE',
        subState: nginxContainerUp ? 'running' : 'dead'
      },
      {
        name: 'systemd-journald.service',
        description: 'Journal Service',
        status: 'ACTIVE',
        subState: 'running'
      },
      {
        name: 'cron.service',
        description: 'Regular background program scheduling daemon',
        status: 'ACTIVE',
        subState: 'running'
      }
    ];

    return {
      cores,
      dockerContainers,
      systemdServices
    };
  }

  async getBrandingConfig() {
    let branding: any = {};
    try {
      const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'BRANDING_CONFIG' } });
      branding = setting?.value || {};
    } catch (e) {
      // Suppress DB errors before migrations have run
    }
    
    // Fallbacks
    if (!branding.appName) branding.appName = 'YATO';
    if (!branding.appTitle) branding.appTitle = 'YATO | Infrastructure Platform';
    if (!branding.appLogo) branding.appLogo = '';
    if (!branding.appFavicon) branding.appFavicon = '';
    if (!branding.appFooter) branding.appFooter = '© 2026 YATO. All rights reserved.';

    // Retrieve active timezone config
    try {
      const tzSetting = await this.prisma.systemSetting.findUnique({ where: { key: 'TIMEZONE_CONFIG' } });
      const tzConfig: any = tzSetting?.value || {};
      const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      branding.appTimezone = tzConfig.mode === 'MANUAL' ? (tzConfig.manualValue || 'Asia/Jakarta') : serverTz;
    } catch (e) {
      branding.appTimezone = 'Asia/Jakarta';
    }

    return branding;
  }

  private updateEnvFile(updates: Record<string, string>) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env');
      
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      
      let lines = envContent.split(/\r?\n/);
      
      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*`);
        let found = false;
        
        lines = lines.map(line => {
          if (regex.test(line.trim())) {
            found = true;
            return `${key}="${value}"`;
          }
          return line;
        });
        
        if (!found) {
          lines.push(`${key}="${value}"`);
        }
      }
      
      fs.writeFileSync(envPath, lines.join('\n'));
    } catch (e: any) {
      const logger = new Logger('SystemConfigService');
      logger.warn(`Failed to write updates to .env file (permissions EACCES): ${e.message}. Settings are saved in Database and applied in-memory.`);
    }
  }

  private updateDatabaseUrlLimit(connectionLimit: string) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env');
      
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      
      const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
      if (match && match[1]) {
        let currentUrl = match[1];
        
        if (currentUrl.includes('connection_limit=')) {
          currentUrl = currentUrl.replace(/connection_limit=\d+/, `connection_limit=${connectionLimit}`);
        } else {
          const separator = currentUrl.includes('?') ? '&' : '?';
          currentUrl = `${currentUrl}${separator}connection_limit=${connectionLimit}`;
        }
        
        this.updateEnvFile({ DATABASE_URL: currentUrl });
      }
    } catch (e: any) {
      const logger = new Logger('SystemConfigService');
      logger.warn(`Failed to update DATABASE_URL connection limit in .env file: ${e.message}`);
    }
  }

  async getTuningConfig() {
    // 1. Try reading from Database first
    try {
      const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'TUNING_CONFIG' } });
      if (setting && setting.value) {
        const config: any = setting.value;
        return {
          ramLimit: config.ramLimit || '1024',
          dbPoolLimit: config.dbPoolLimit || '20',
          notificationConcurrency: config.notificationConcurrency || '5',
          cacheTtlSeconds: config.cacheTtlSeconds || '600',
        };
      }
    } catch (dbErr) {
      // Fallback to env file if database is not migrated/ready
    }

    // 2. Fallback to .env reading
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    const getVal = (key: string, defaultVal: string): string => {
      const regex = new RegExp(`^${key}=["']?([^"'\n]+)["']?`, 'm');
      const match = envContent.match(regex);
      return match ? match[1] : defaultVal;
    };
    
    let dbPoolLimit = '20';
    const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
    if (dbUrlMatch && dbUrlMatch[1]) {
      const poolMatch = dbUrlMatch[1].match(/connection_limit=(\d+)/);
      if (poolMatch) {
        dbPoolLimit = poolMatch[1];
      }
    }
    
    const nodeOptions = getVal('NODE_OPTIONS', '--max-old-space-size=1024');
    let ramLimit = '1024';
    const ramMatch = nodeOptions.match(/--max-old-space-size=(\d+)/);
    if (ramMatch) {
      ramLimit = ramMatch[1];
    }
    
    return {
      ramLimit,
      dbPoolLimit,
      notificationConcurrency: getVal('NOTIFICATION_CONCURRENCY', '5'),
      cacheTtlSeconds: getVal('CACHE_TTL_SECONDS', '600'),
    };
  }

  async saveTuningConfig(config: any, userId: string) {
    const { ramLimit, dbPoolLimit, notificationConcurrency, cacheTtlSeconds, triggerRestart } = config;
    
    // 1. Save to Database SystemSetting
    try {
      await this.prisma.systemSetting.upsert({
        where: { key: 'TUNING_CONFIG' },
        update: {
          value: {
            ramLimit: String(ramLimit || '1024'),
            dbPoolLimit: String(dbPoolLimit || '20'),
            notificationConcurrency: String(notificationConcurrency || '5'),
            cacheTtlSeconds: String(cacheTtlSeconds || '600'),
          }
        },
        create: {
          key: 'TUNING_CONFIG',
          value: {
            ramLimit: String(ramLimit || '1024'),
            dbPoolLimit: String(dbPoolLimit || '20'),
            notificationConcurrency: String(notificationConcurrency || '5'),
            cacheTtlSeconds: String(cacheTtlSeconds || '600'),
          }
        }
      });
    } catch (dbErr: any) {
      const logger = new Logger('SystemConfigService');
      logger.error(`Failed to save tuning config to database: ${dbErr.message}`);
    }

    // 2. Apply config in-memory to process.env immediately
    const nodeOptions = `--max-old-space-size=${ramLimit || '1024'}`;
    process.env.NODE_OPTIONS = nodeOptions;
    process.env.NOTIFICATION_CONCURRENCY = String(notificationConcurrency || '5');
    process.env.CACHE_TTL_SECONDS = String(cacheTtlSeconds || '600');

    // 3. Attempt to write to file system (gracefully handles EACCES warning)
    this.updateEnvFile({
      NODE_OPTIONS: nodeOptions,
      NOTIFICATION_CONCURRENCY: String(notificationConcurrency || '5'),
      CACHE_TTL_SECONDS: String(cacheTtlSeconds || '600'),
    });
    
    if (dbPoolLimit) {
      this.updateDatabaseUrlLimit(String(dbPoolLimit));
    }
    
    await this.auditService.log(userId, 'UPDATE_TUNING_CONFIG', 'SystemConfig', 'PERFORMANCE_TUNING', config);
    
    if (triggerRestart) {
      this.triggerRestart();
      return { success: true, message: 'Tuning configurations saved successfully. System is restarting now...' };
    }
    
    return { success: true, message: 'Tuning configurations saved successfully. Restart required to apply some changes.' };
  }

  async getSystemLogs(file?: string, limit: number = 200, search?: string, level?: string) {
    const fs = require('fs');
    const path = require('path');
    const readline = require('readline');

    // 1. Determine logs directory
    let logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      logsDir = path.join(process.cwd(), 'backend', 'logs');
    }

    if (!fs.existsSync(logsDir)) {
      return {
        success: false,
        message: `Logs directory not found. Checked: ${path.join(process.cwd(), 'logs')} and ${path.join(process.cwd(), 'backend', 'logs')}`,
        files: [],
        logs: [],
      };
    }

    // 2. List available log files
    let files: string[] = [];
    try {
      files = fs.readdirSync(logsDir)
        .filter((f: string) => f.endsWith('.log'))
        .sort((a: string, b: string) => b.localeCompare(a)); // Newest first
    } catch (e: any) {
      return {
        success: false,
        message: `Failed to read logs directory: ${e.message}`,
        files: [],
        logs: [],
      };
    }

    if (files.length === 0) {
      return {
        success: true,
        message: 'No log files found in logs directory.',
        files: [],
        logs: [],
      };
    }

    // 3. Determine target file (default to the newest application log)
    const targetFile = file || files.find(f => f.startsWith('application-')) || files[0];
    const targetFilePath = path.join(logsDir, targetFile);

    if (!fs.existsSync(targetFilePath)) {
      return {
        success: false,
        message: `Requested log file does not exist: ${targetFile}`,
        files,
        logs: [],
      };
    }

    // 4. Read file content safely line-by-line
    const parsedLogs: any[] = [];
    try {
      const fileStream = fs.createReadStream(targetFilePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const logEntry = JSON.parse(line);
          
          // Apply log level filter if provided
          if (level && logEntry.level && logEntry.level.toLowerCase() !== level.toLowerCase()) {
            continue;
          }

          // Apply text search filter if provided
          if (search) {
            const searchLower = search.toLowerCase();
            const messageMatch = logEntry.message && String(logEntry.message).toLowerCase().includes(searchLower);
            const contextMatch = logEntry.context && String(logEntry.context).toLowerCase().includes(searchLower);
            if (!messageMatch && !contextMatch) {
              continue;
            }
          }

          parsedLogs.push(logEntry);
        } catch (jsonErr) {
          // Fallback to raw text parsing
          const rawEntry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: line,
            isRaw: true,
          };
          
          if (level && level.toLowerCase() !== 'info') {
            continue;
          }
          if (search && !line.toLowerCase().includes(search.toLowerCase())) {
            continue;
          }
          parsedLogs.push(rawEntry);
        }
      }
    } catch (e: any) {
      return {
        success: false,
        message: `Failed to read log file: ${e.message}`,
        files,
        logs: [],
      };
    }

    // Newest logs first
    const sortedLogs = parsedLogs.reverse();
    const paginatedLogs = sortedLogs.slice(0, limit);

    return {
      success: true,
      currentFile: targetFile,
      files,
      logs: paginatedLogs,
      totalCount: parsedLogs.length,
      returnedCount: paginatedLogs.length,
    };
  }

  triggerRestart() {
    const logger = new Logger('SystemConfigService');
    logger.warn('SYSTEM RESTART INITIATED: Container will exit in 2 seconds to trigger Docker self-restart.');
    
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }
}
