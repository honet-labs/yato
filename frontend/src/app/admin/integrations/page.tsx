"use client";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { IntegrationModal } from "./components/IntegrationModal";
import { 
  Plug, 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2, 
  Power, 
  PowerOff,
  Link as LinkIcon,
  Server,
  Activity,
  Bell,
  UploadCloud,
  FileCode,
  CheckCircle,
  HelpCircle,
  FileText,
  X,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface IntegrationData {
  id: string;
  name: string;
  type: string;
  connectorKey: string;
  endpointUrl: string;
  isActive: boolean;
  config: any;
}

interface PluginManifest {
  connectorKey: string;
  name: string;
  type: string;
  description: string;
  fields: any[];
  driverCode: string;
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("CONNECTIONS" as "CONNECTIONS" | "PLUGINS");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null as IntegrationData | null);
  
  // Custom Plugin Upload Form State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [uploadError, setUploadError] = useState("");

  // Fetch active connections
  const { data: integrations, isLoading: isIntegrationsLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const response = await api.get("/integrations");
      return response.data;
    },
  });

  // Fetch uploaded connector plugins
  const { data: plugins, isLoading: isPluginsLoading } = useQuery({
    queryKey: ["connector-plugins"],
    queryFn: async () => {
      const response = await api.get("/integrations/plugins");
      return response.data;
    },
  });

  // Dynamic status mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      api.put(`/integrations/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  // Plugin upload mutation
  const uploadPluginMutation = useMutation({
    mutationFn: (plugin: any) => api.post("/integrations/plugins/upload", plugin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connector-plugins"] });
      setIsUploadOpen(false);
      setPastedJson("");
      setUploadError("");
    },
    onError: (err: any) => {
      setUploadError(err.message || "Failed to register plugin. Verify JSON format.");
    }
  });

  // Plugin delete mutation
  const deletePluginMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/integrations/plugins/${key}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connector-plugins"] });
    }
  });

  const handleEdit = (integration: IntegrationData) => {
    setEditingIntegration(integration);
    setIsModalOpen(true);
  };

  const handleUploadPlugin = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    try {
      const parsed = JSON.parse(pastedJson);
      if (!parsed.connectorKey || !parsed.name || !parsed.type) {
        throw new Error("Missing required fields: connectorKey, name, type");
      }
      uploadPluginMutation.mutate(parsed);
    } catch (err: any) {
      setUploadError(`Invalid Plugin JSON: ${err.message}`);
    }
  };

  const getIconForType = (type: string) => {
    switch(type) {
      case 'PROVISIONING': return <Server className="w-5 h-5 text-indigo-500" />;
      case 'MONITORING': return <Activity className="w-5 h-5 text-emerald-500" />;
      case 'NOTIFICATION': return <Bell className="w-5 h-5 text-amber-500" />;
      default: return <Plug className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBadgeForType = (type: string) => {
    switch(type) {
      case 'PROVISIONING': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'MONITORING': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'NOTIFICATION': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  const samplePluginTemplate = {
    connectorKey: "tableau-connector",
    name: "Tableau Dashboard Sync",
    type: "MONITORING",
    description: "Embed secure Tableau visual sheets directly inside YATO client workspaces.",
    fields: [
      { key: "tableauUrl", label: "Tableau Server URL", type: "text", placeholder: "https://tableau.local", required: true },
      { key: "siteName", label: "Site Name", type: "text", placeholder: "Default", required: true },
      { key: "username", label: "Username / API Client", type: "text", placeholder: "tableau_admin", required: true },
      { key: "secretKey", label: "Secret API Key", type: "password", placeholder: "xxxx-xxxx", required: true }
    ],
    driverCode: "// Custom driver JS code goes here..."
  };

  return (
    <div className="flex h-screen bg-background font-sans text-[13px]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <PageHeader title="Integration Hub" subtitle="Manage connector plugins, dynamic drivers, and active hypervisor endpoints" />
          </div>
          <div className="flex items-center gap-4 md:ml-auto">
            {activeTab === "CONNECTIONS" ? (
              <button 
                onClick={() => {
                  setEditingIntegration(null);
                  setIsModalOpen(true);
                }}
                className="btn-primary flex items-center gap-2.5 whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Connection</span>
              </button>
            ) : (
              <button 
                onClick={() => setIsUploadOpen(true)}
                className="btn-primary flex items-center gap-2.5 whitespace-nowrap bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Plugin Manifest</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Navigation Tabs */}
        <div className="flex border-b border-slate-100 mb-8 gap-6 shrink-0">
          <button
            onClick={() => setActiveTab("CONNECTIONS")}
            className={cn(
              "pb-4 font-bold text-sm uppercase tracking-wider relative transition-all",
              activeTab === "CONNECTIONS" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Active Connections ({integrations?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("PLUGINS")}
            className={cn(
              "pb-4 font-bold text-sm uppercase tracking-wider relative transition-all",
              activeTab === "PLUGINS" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Connector Plugins ({plugins?.length || 0})
          </button>
        </div>

        {activeTab === "CONNECTIONS" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isIntegrationsLoading ? (
              <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 glass-card">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                <p className="text-xs font-bold uppercase tracking-widest">Loading Connections...</p>
              </div>
            ) : integrations?.length === 0 ? (
               <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 glass-card">
                <Plug className="w-12 h-12 mb-4 text-slate-200" />
                <p className="text-sm font-bold tracking-tight text-slate-500">No Active Connections Configured</p>
                <p className="text-[11px] font-bold uppercase tracking-widest mt-1 text-slate-400">Click "Add Connection" to link an hypervisor or service</p>
              </div>
            ) : (
              integrations?.map((integration) => {
                const pluginMeta = plugins?.find(p => p.connectorKey === integration.connectorKey);
                return (
                  <motion.div 
                    key={integration.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "glass-card p-6 relative group transition-all duration-300 border-2 overflow-hidden",
                      integration.isActive ? "border-transparent hover:border-blue-100" : "border-slate-100/50 opacity-75 grayscale-[0.3]"
                    )}
                  >
                    {!integration.isActive && (
                      <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[9px] font-bold px-3 py-1 uppercase tracking-widest rounded-bl-xl z-10">
                        Disabled
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                          {getIconForType(integration.type)}
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-slate-900 tracking-tight">{integration.name}</h3>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Connector: {pluginMeta?.name || integration.connectorKey}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                        <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-xs font-mono text-slate-600 truncate">{integration.endpointUrl}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className={cn("badge uppercase tracking-wider text-[9px] font-bold", getBadgeForType(integration.type))}>
                          {integration.type}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleStatusMutation.mutate({ id: integration.id, isActive: !integration.isActive })}
                        className={cn(
                          "flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors",
                          integration.isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                        )}
                      >
                        {integration.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        {integration.isActive ? "Disable" : "Enable"}
                      </button>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleEdit(integration)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if(confirm('Are you sure you want to delete this connection?')) {
                              deleteMutation.mutate(integration.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        ) : (
          /* PLUGINS TEMPLATE LIST VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isPluginsLoading ? (
              <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 glass-card">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                <p className="text-xs font-bold uppercase tracking-widest">Loading plugins...</p>
              </div>
            ) : plugins?.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 glass-card">
                <UploadCloud className="w-12 h-12 mb-4 text-slate-200" />
                <p className="text-sm font-bold tracking-tight text-slate-500">No Custom Plugins Registered</p>
                <p className="text-[11px] font-bold uppercase tracking-widest mt-1 text-slate-400">Click "Upload Plugin Manifest" to install a connector driver</p>
              </div>
            ) : (
              plugins?.map((plugin) => (
                <motion.div 
                  key={plugin.connectorKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-6 relative group transition-all duration-300 hover:border-emerald-100 border-2 border-transparent"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-center">
                        <FileCode className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 tracking-tight">{plugin.name}</h3>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mt-0.5">{plugin.connectorKey}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-6 h-10 overflow-hidden text-ellipsis">
                    {plugin.description || "No description provided."}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className={cn("badge uppercase tracking-wider text-[8px] font-bold", getBadgeForType(plugin.type))}>
                      {plugin.type}
                    </span>
                    <span className="badge uppercase tracking-wider text-[8px] font-bold bg-slate-50 text-slate-500 border-slate-100">
                      {plugin.fields?.length || 0} Config Fields
                    </span>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingIntegration(null);
                        setEditingIntegration({
                          id: "",
                          name: "",
                          type: plugin.type,
                          connectorKey: plugin.connectorKey,
                          endpointUrl: "",
                          isActive: true,
                          config: {}
                        } as any);
                        setIsModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 uppercase tracking-widest px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Connection
                    </button>
                    
                    {/* Only show delete on custom non-core plugins */}
                    {plugin.connectorKey !== 'proxmox-ve' && (
                      <button 
                        onClick={() => {
                          if (confirm(`Uninstall connector plugin "${plugin.name}"? Active connections using this key may stop functioning!`)) {
                            deletePluginMutation.mutate(plugin.connectorKey);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>
      </div>

      {/* Dynamic Connection Modeler Modal */}
      <IntegrationModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingIntegration(null);
        }}
        editingIntegration={editingIntegration}
      />

      {/* UPLOAD CUSTOM CONNECTOR PLUGIN MANIFEST MODAL */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-600/20">
                    <UploadCloud className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">Upload Connector Plugin</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Register a custom plugin driver manifest</p>
                  </div>
                </div>
                <button onClick={() => { setIsUploadOpen(false); setUploadError(""); }} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="overflow-y-auto custom-scrollbar flex-1">
                <form id="upload-plugin-form" onSubmit={handleUploadPlugin} className="p-8 space-y-6">
                  
                  {uploadError && (
                    <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex gap-3 bg-blue-50/50 border border-blue-100/50 rounded-2xl p-4 text-blue-800 text-xs leading-relaxed">
                      <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                      <div>
                        <span className="font-bold">How it works:</span> Paste the JSON manifest defining your connector's name, type, configuration fields, and integration driver JavaScript logic below.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Manifest Script (JSON)</label>
                        <button
                          type="button"
                          onClick={() => setPastedJson(JSON.stringify(samplePluginTemplate, null, 2))}
                          className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"
                        >
                          Load Sample Template
                        </button>
                      </div>
                      
                      <textarea
                        required
                        placeholder='{\n  "connectorKey": "my-connector",\n  "name": "My Custom Service",\n  ...\n}'
                        className="input-field w-full h-80 font-mono text-xs leading-relaxed py-3 resize-none bg-slate-900 text-slate-300 custom-scrollbar"
                        spellCheck={false}
                        value={pastedJson}
                        onChange={e => { setPastedJson(e.target.value); setUploadError(""); }}
                      />
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-8 border-t border-slate-50 bg-slate-50/50 shrink-0">
                <button 
                  type="submit" 
                  form="upload-plugin-form"
                  disabled={uploadPluginMutation.isPending}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-bold"
                >
                  {uploadPluginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  <span>Install Plugin Connector</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
