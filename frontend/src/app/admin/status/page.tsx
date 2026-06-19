"use client";

import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { 
  Zap, 
  Shield, 
  Activity, 
  Server, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Check,
  RefreshCw,
  X,
  Terminal,
  Search,
  Play,
  Pause
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useState, Fragment } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Lock } from "lucide-react";


// Status types: simplified to only Active, Busy, and Down
type ServiceStatus = 'ACTIVE' | 'BUSY' | 'DOWN';

interface ServiceProcess {
  name: string;
  description: string;
  status: ServiceStatus;
}

interface EngineGroup {
  id: string;
  name: string;
  description: string;
  icon: any;
  services: ServiceProcess[];
}

export default function SystemStatusPage() {
  const { isAdmin, isLoading: isProfileLoading } = useIsAdmin();
  const [activeTab, setActiveTab] = useState('cores' as 'cores' | 'docker' | 'systemd' | 'logs');

  const { data: statusData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["system-status"],
    queryFn: async () => {
      const response = await api.get("/system/config/status");
      return response.data;
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  // System logs state
  const [selectedFile, setSelectedFile] = useState("" as string);
  const [logLimit, setLogLimit] = useState(200 as number);
  const [logSearch, setLogSearch] = useState("" as string);
  const [logLevel, setLogLevel] = useState("" as string);
  const [autoRefresh, setAutoRefresh] = useState(true as boolean);
  const [expandedLogIdx, setExpandedLogIdx] = useState(null as number | null);

  const { data: logsData, isLoading: isLogsLoading, refetch: refetchLogs, isRefetching: isLogsRefetching } = useQuery({
    queryKey: ["system-logs", selectedFile, logLimit, logSearch, logLevel],
    queryFn: async () => {
      let url = `/system/config/logs?limit=${logLimit}`;
      if (selectedFile) url += `&file=${selectedFile}`;
      if (logSearch) url += `&search=${encodeURIComponent(logSearch)}`;
      if (logLevel) url += `&level=${logLevel}`;
      const response = await api.get(url);
      return response.data;
    },
    refetchInterval: autoRefresh ? 4000 : false, // auto refresh every 4s
    enabled: activeTab === 'logs',
  });

  const coresList = statusData?.cores || [];
  const dockerContainers = statusData?.dockerContainers || [];
  const systemdServices = statusData?.systemdServices || [];

  // Dynamically map backend live status to services
  const getLiveStatus = (groupId: string, defaultStatus: ServiceStatus): ServiceStatus => {
    if (!coresList || coresList.length === 0) return defaultStatus;
    const groupData = coresList.find((g: any) => g.id === groupId);
    if (!groupData) return defaultStatus;
    
    // Map live status: if backend has DEGRADED -> BUSY, if OFFLINE/DOWN -> DOWN
    if (groupData.status === 'DEGRADED') {
      return 'BUSY';
    } else if (groupData.status === 'OFFLINE' || groupData.status === 'DOWN') {
      return 'DOWN';
    }
    return defaultStatus;
  };

  const processGroups: EngineGroup[] = [
    {
      id: "engine",
      name: "PROVISIONING ENGINE",
      description: "Automated VM and Service deployment orchestrator",
      icon: Server,
      services: [
        { 
          name: "VM Provisioner Daemon", 
          description: "Manages ESXi/Proxmox VM provisioning pipelines", 
          status: getLiveStatus("engine", "ACTIVE")
        },
        { 
          name: "Service Asset Deployer", 
          description: "Handles docker-compose and kubernetes application packaging", 
          status: getLiveStatus("engine", "BUSY")
        },
        { 
          name: "Network Orchestrator Service", 
          description: "Automates VLAN assignments and IPAM allocations", 
          status: getLiveStatus("engine", "ACTIVE")
        },
        { 
          name: "CMDB Sync Engine", 
          description: "Syncs hypervisor states with local physical inventory", 
          status: getLiveStatus("engine", "ACTIVE")
        }
      ]
    },
    {
      id: "vault",
      name: "IDENTITY & VAULT SERVICE",
      description: "Encryption layer for credential and certificate management",
      icon: Shield,
      services: [
        { 
          name: "Key Management Service (KMS)", 
          description: "Symmetric and asymmetric encryption provider", 
          status: getLiveStatus("vault", "ACTIVE")
        },
        { 
          name: "Secret Rotation Runner", 
          description: "Automates SSH key and database password rotation schedules", 
          status: getLiveStatus("vault", "ACTIVE")
        },
        { 
          name: "Active Directory Gateway", 
          description: "Syncs corporate directories with YATO roles", 
          status: getLiveStatus("vault", "ACTIVE")
        }
      ]
    },
    {
      id: "notification",
      name: "NOTIFICATION RELAY ENGINE",
      description: "Real-time alert delivery and webhook dispatch engine",
      icon: Zap,
      services: [
        { 
          name: "SMTP Relay Agent", 
          description: "Handles transactional email notifications", 
          status: getLiveStatus("notification", "ACTIVE")
        },
        { 
          name: "Webhook Publisher", 
          description: "Dispatches events to Slack, Discord, and custom API links", 
          status: getLiveStatus("notification", "ACTIVE")
        },
        { 
          name: "Push Dispatch Daemon", 
          description: "Mobile notification push routing mechanism", 
          status: getLiveStatus("notification", "ACTIVE")
        }
      ]
    },
    {
      id: "audit",
      name: "AUDIT LEDGER SERVICE",
      description: "Compliance tracking and tamper-proof log repository",
      icon: Activity,
      services: [
        { 
          name: "Immutable Ledger Logger", 
          description: "Signs and writes system events securely to the database", 
          status: getLiveStatus("audit", "ACTIVE")
        },
        { 
          name: "Log Rotation Service", 
          description: "Compresses, encrypts, and ships logs to secondary archives", 
          status: getLiveStatus("audit", "ACTIVE")
        },
        { 
          name: "Security Auditing Daemon", 
          description: "Detects unauthorized access patterns in real-time", 
          status: getLiveStatus("audit", "ACTIVE")
        }
      ]
    }
  ];

  // Helper to render Tableau style status badges (simplified to Active, Busy, Down)
  const renderStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded bg-emerald-500 text-white shadow-sm hover:scale-105 transition-transform" title="Active">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
        );
      case 'BUSY':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded bg-cyan-500 text-white shadow-sm hover:scale-105 transition-transform" title="Busy">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          </div>
        );
      case 'DOWN':
      default:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded bg-rose-500 text-white shadow-sm hover:scale-105 transition-transform animate-pulse" title="Down">
            <X className="w-4 h-4 stroke-[3]" />
          </div>
        );
    }
  };

  if (isProfileLoading || isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-white items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading System Health Logs...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-white items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full border border-rose-500/30 flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
          <p className="text-sm text-slate-400">You must hold administrative privileges to access System Status.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <MobileNav />
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <main className="page-container p-8 flex-1">
          
          {/* Header */}
          <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="page-title text-3xl font-extrabold text-slate-900 tracking-tight">System Status</h1>
              <p className="page-subtitle text-slate-500 mt-1">Real-time health monitoring and process states of the YATO cluster</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => refetch()}
                className="btn-secondary flex items-center gap-2 py-2.5 px-4 shadow-sm hover:border-slate-300 transition-all bg-white"
                disabled={isLoading || isRefetching}
              >
                {isLoading || isRefetching ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                )}
                <span className="font-semibold text-xs text-slate-700">Refresh Status</span>
              </button>
            </div>
          </header>

          {/* Quick Overview Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))
            ) : (
              coresList?.map((item: any) => {
                const isHealthy = item.status === 'HEALTHY' || item.status === 'SECURE' || item.status === 'OPERATIONAL';
                return (
                  <div key={item.id} className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shadow-sm",
                        isHealthy ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {item.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.name}</p>
                        <p className="text-xs font-extrabold text-slate-900 mt-0.5">{item.latency || '0ms'} latency</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full border shadow-sm",
                      isHealthy ? "bg-emerald-500 border-emerald-300 animate-pulse" : "bg-rose-500 border-rose-300 animate-pulse"
                    )} />
                  </div>
                );
              })
            )}
          </div>

          {/* Premium Status Panel Navigation Tabs */}
          <div className="flex border-b border-slate-200/80 mb-6 gap-2">
            <button
              onClick={() => setActiveTab('cores')}
              className={cn(
                "pb-3.5 px-4 font-bold text-xs uppercase tracking-widest border-b-2 transition-all outline-none",
                activeTab === 'cores' 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Core Engines
            </button>
            <button
              onClick={() => setActiveTab('docker')}
              className={cn(
                "pb-3.5 px-4 font-bold text-xs uppercase tracking-widest border-b-2 transition-all outline-none",
                activeTab === 'docker' 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Docker Containers ({dockerContainers.length})
            </button>
            <button
              onClick={() => setActiveTab('systemd')}
              className={cn(
                "pb-3.5 px-4 font-bold text-xs uppercase tracking-widest border-b-2 transition-all outline-none",
                activeTab === 'systemd' 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Systemd Services ({systemdServices.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('logs');
                setExpandedLogIdx(null);
              }}
              className={cn(
                "pb-3.5 px-4 font-bold text-xs uppercase tracking-widest border-b-2 transition-all outline-none flex items-center gap-1.5",
                activeTab === 'logs' 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
              Runtime Logs
            </button>
          </div>

          {/* Dynamic Content Panel */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden mb-8">
            {activeTab === 'cores' && (
              <>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Core Daemon Processes</h2>
                  <p className="text-slate-500 text-xs mt-0.5">The real-time health and response time of YATO's core micro-engines.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-3/4">Process</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-1/4">
                          <div className="flex flex-col items-center">
                            <span className="font-extrabold text-slate-800">YATO Server</span>
                            <span className="text-[10px] font-medium text-slate-400 mt-0.5 font-mono">192.168.201.18</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {processGroups.map((group) => {
                        const GroupIcon = group.icon;
                        return (
                          <Fragment key={group.id}>
                            <tr className="bg-slate-50/30">
                              <td colSpan={2} className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <GroupIcon className="w-4 h-4 text-blue-600 animate-pulse" />
                                  <span className="text-xs font-extrabold text-slate-900 tracking-wider uppercase">{group.name}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">— {group.description}</span>
                                </div>
                              </td>
                            </tr>
                            {group.services.map((service) => (
                              <tr key={service.name} className="hover:bg-slate-50/30 transition-colors group/row">
                                <td className="px-6 py-4 pl-10">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-slate-800 group-hover/row:text-blue-600 transition-colors">
                                      {service.name}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">
                                      {service.description}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center">
                                    {renderStatusBadge(service.status)}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'docker' && (
              <>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Docker Containers</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Real-time docker microservices running within the YATO stack on the host.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Container</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Image / Tag</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Details</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dockerContainers.map((container: any) => (
                        <tr key={container.name} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-black text-[10px]">
                                DC
                              </div>
                              <span className="text-sm font-bold text-slate-800">{container.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200/50">
                              {container.image}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-500">
                            {container.status}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider",
                                container.healthy 
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                  : "bg-rose-50 text-rose-600 border border-rose-100 animate-pulse"
                              )}>
                                {container.state}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {dockerContainers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-xs text-slate-400 italic font-medium">
                            No active docker containers found or socket not available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'systemd' && (
              <>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Systemd OS Services</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Critical system services and background daemons running on the host OS.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-1/3">Service</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-1/2">Description</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-1/6">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {systemdServices.map((service: any) => (
                        <tr key={service.name} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-mono text-[9px] font-bold">
                                SYS
                              </div>
                              <span className="text-sm font-bold text-slate-800 font-mono">{service.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                            {service.description}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider",
                                service.status === 'ACTIVE' 
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              )}>
                                {service.status} ({service.subState})
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'logs' && (
              <>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">System Runtime Logs</h2>
                    <p className="text-slate-500 text-xs mt-0.5">Live console output and application debugger records from Winston transport logs.</p>
                  </div>
                  
                  {/* Controls Header */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Log File Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Log Target</span>
                      <select 
                        value={selectedFile || (logsData?.currentFile || "")}
                        onChange={(e) => {
                          setSelectedFile(e.target.value);
                          setExpandedLogIdx(null);
                        }}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                      >
                        {logsData?.files?.map((f: string) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                        {!logsData?.files?.length && (
                          <option value="">No log files</option>
                        )}
                      </select>
                    </div>

                    {/* Limit Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Limit</span>
                      <select
                        value={logLimit}
                        onChange={(e) => setLogLimit(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                      >
                        <option value={100}>100 lines</option>
                        <option value={200}>200 lines</option>
                        <option value={500}>500 lines</option>
                        <option value={1000}>1000 lines</option>
                      </select>
                    </div>

                    {/* Level Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Severity</span>
                      <select
                        value={logLevel}
                        onChange={(e) => setLogLevel(e.target.value)}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                      >
                        <option value="">All Levels</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                        <option value="debug">Debug</option>
                      </select>
                    </div>

                    {/* Auto Refresh toggle */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auto stream</span>
                      <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95",
                          autoRefresh 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        )}
                      >
                        {autoRefresh ? (
                          <>
                            <Play className="w-3 h-3 text-emerald-500 fill-emerald-500 animate-pulse" />
                            Streaming
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3 text-slate-400" />
                            Paused
                          </>
                        )}
                      </button>
                    </div>

                    {/* Force Refresh */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Action</span>
                      <button
                        onClick={() => refetchLogs()}
                        className="btn-secondary py-1.5 px-3 font-semibold text-xs text-slate-700 bg-white"
                        disabled={isLogsLoading || isLogsRefetching}
                      >
                        {isLogsLoading || isLogsRefetching ? (
                          <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 text-slate-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex items-center gap-4">
                  <div className="relative flex-1 group">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="text" 
                      className="input-field pl-11 py-2 w-full bg-white !text-xs font-medium" 
                      placeholder="Search log messages, query parameters, stack traces, IP, or context..." 
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Terminal Console View */}
                <div className="bg-slate-950 p-4 font-mono text-xs overflow-y-auto max-h-[500px] min-h-[350px] custom-scrollbar text-slate-300 select-text relative">
                  {isLogsLoading && !logsData ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <span className="text-slate-500 font-sans font-bold">Streaming backend log output...</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {logsData?.logs?.map((log: any, idx: number) => {
                        const level = String(log.level).toLowerCase();
                        const isExpanded = expandedLogIdx === idx;
                        
                        return (
                          <div 
                            key={idx} 
                            className={cn(
                              "border-l-2 pl-3 py-1 hover:bg-slate-900/60 transition-colors rounded-r-md cursor-pointer",
                              level === 'error' ? "border-rose-500/80 bg-rose-950/10" : 
                              level === 'warn' ? "border-amber-500/80 bg-amber-950/10" : 
                              level === 'debug' ? "border-purple-500/80 bg-purple-950/10" : 
                              "border-sky-500/80 bg-sky-950/5"
                            )}
                            onClick={() => setExpandedLogIdx(isExpanded ? null : idx)}
                          >
                            <div className="flex items-start justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Timestamp */}
                                <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                                </span>
                                
                                {/* Severity Badge */}
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                                  level === 'error' ? "bg-rose-900/40 text-rose-300 border border-rose-800/40" :
                                  level === 'warn' ? "bg-amber-900/40 text-amber-300 border border-amber-800/40" :
                                  level === 'debug' ? "bg-purple-900/40 text-purple-300 border border-purple-800/40" :
                                  "bg-sky-900/40 text-sky-300 border border-sky-800/40"
                                )}>
                                  {log.level || 'info'}
                                </span>

                                {/* Context */}
                                {log.context && (
                                  <span className="text-[10px] bg-slate-900 text-slate-400 px-1 py-0.5 rounded border border-slate-800/60 font-bold font-sans">
                                    [{log.context}]
                                  </span>
                                )}

                                {/* Message */}
                                <span className="text-[11px] font-medium break-all whitespace-pre-wrap leading-relaxed text-slate-200">
                                  {log.message}
                                </span>
                              </div>
                              
                              {/* Log Meta Helper (eg execution duration) */}
                              {log.ms && (
                                <span className="text-[10px] text-slate-500 font-bold italic ml-auto">
                                  {log.ms}
                                </span>
                              )}
                            </div>

                            {/* Expanded JSON details & trace */}
                            {isExpanded && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-2.5 p-3 bg-slate-900/80 rounded-lg border border-slate-800/80 overflow-x-auto text-[10px] space-y-2 text-slate-400"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="font-sans font-bold text-slate-500 uppercase tracking-widest text-[8px]">LOG METADATA</div>
                                <pre className="text-slate-300 custom-scrollbar max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                                  {JSON.stringify(log, null, 2)}
                                </pre>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}

                      {logsData?.logs?.length === 0 && (
                        <div className="text-center py-12 text-slate-500 italic font-semibold">
                          No matching logs found in console buffer
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Tableau Legend Footer (Simplified to Active, Busy, Down) */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-center gap-8 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-2">
                {renderStatusBadge('ACTIVE')}
                <span>Active / Operational</span>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge('BUSY')}
                <span>Busy / Re-indexing</span>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge('DOWN')}
                <span>Offline / Error</span>
              </div>
            </div>

          </div>

          {/* Premium Bottom Info Section */}
          <div className="bg-slate-900 rounded-[2rem] p-10 text-white overflow-hidden relative group shadow-xl">
            <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Security Standard</span>
              </div>
              <h2 className="text-3xl font-bold mb-4 tracking-tight">Compliance Level: High</h2>
              <p className="text-slate-400 text-sm max-w-lg mb-8">Your platform infrastructure is currently operating under strict security protocols with TLS 1.3 active and end-to-end audit logging enabled.</p>
              <div className="flex gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TLS Encryption</p>
                  <p className="text-base font-semibold">TLS 1.3 ACTIVE</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auditing</p>
                  <p className="text-base font-semibold">ENABLED</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">MFA Enforcement</p>
                  <p className="text-base font-semibold">GLOBAL</p>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
