"use client";
import { PageHeader } from "@/components/PageHeader";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Pagination } from "@/components/Pagination";
import { 
  Box, 
  Search, 
  Filter, 
  Loader2, 
  ExternalLink,
  ShieldCheck,
  Server,
  Activity,
  Copy,
  Check,
  Plus,
  Globe,
  Layers,
  Settings,
  X,
  Zap,
  Shield,
  User as UserIcon,
  Lock,
  Download,
  Trash2
} from "lucide-react";
import { exportToCSV } from "@/lib/csvHelper";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface ServiceInventory {
  id: string;
  serviceName: string;
  version: string;
  environment: string;
  endpoint: string;
  status: string;
  requestedBy?: string;
  ticketId?: string;
  address?: string;
  port?: number;
  username?: string;
  password?: string;
  createdAt: string;
}

export default function ServiceInventoryPage() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState(null as string | null);
  const [showEditModal, setShowEditModal] = useState(null as ServiceInventory | null);
  const [viewingDetails, setViewingDetails] = useState(null as ServiceInventory | null);
  const [editData, setEditData] = useState({
    endpoint: "",
    address: "",
    port: 22,
    username: "",
    password: "",
    status: ""
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await api.get("/auth/profile");
      return response.data;
    },
  });

  const isAdmin = userProfile?.roles?.some((r: any) => r.role.name === 'ADMIN' || r.role.name === 'SUPERADMIN');

  const { data: items, isLoading } = useQuery({
    queryKey: ["service-inventory"],
    queryFn: async () => {
      const response = await api.get("/service-inventory/");
      return response.data;
    },
  });

  const handleExport = () => {
    if (!items) return;
    const exportData = items.map(item => ({
      'Ticket ID': item.ticketId,
      'Service Name': item.serviceName,
      'Version': item.version,
      'Environment': item.environment,
      'Endpoint': item.endpoint,
      'Status': item.status,
      'Owner': item.requestedBy,
      'Created At': new Date(item.createdAt).toLocaleDateString()
    }));
    exportToCSV(exportData, 'YATO_Service_Inventory');
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/service-inventory/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-inventory"] });
      setShowEditModal(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-inventory"] });
    }
  });

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredItems = items?.filter(item => 
    item.serviceName.toLowerCase().includes(search.toLowerCase()) ||
    item.endpoint?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <PageHeader title="Service Assets" subtitle="Active infrastructure services and endpoints" />
          </div>
          <button 
            onClick={handleExport}
            className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </header>

        <div className="flex gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              className="input-field pl-11 py-3 w-full bg-slate-50 border-slate-50 focus:bg-white transition-all shadow-none" 
              placeholder="Search by service name or endpoint..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-50 rounded-2xl overflow-visible shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Asset</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Environment</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL</th>
                {isAdmin && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Owner</th>}
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-40" /></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-100 rounded-full w-20 mx-auto" /></td>
                    {isAdmin && <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>}
                    <td className="px-6 py-4"><div className="h-8 bg-slate-100 rounded-lg w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : paginatedItems?.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="py-24 text-center">
                    <Box className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">No provisioned services found</p>
                  </td>
                </tr>
              ) : (
                paginatedItems?.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <Layers className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-900">{item.serviceName}</p>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">{item.version}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border shadow-sm",
                        item.environment?.toUpperCase() === 'PRODUCTION' ? "bg-rose-50 text-rose-600 border-rose-100" :
                        item.environment?.toUpperCase() === 'STAGING' ? "bg-blue-50 text-blue-600 border-blue-100" :
                        "bg-slate-50 text-slate-600 border-slate-100"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          item.environment?.toUpperCase() === 'PRODUCTION' ? "bg-rose-500" :
                          item.environment?.toUpperCase() === 'STAGING' ? "bg-blue-500" :
                          "bg-slate-400"
                        )} />
                        {item.environment?.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION (DC)' : (item.environment || 'DEVELOPMENT')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.endpoint ? (
                            <>
                              <a 
                                href={item.endpoint.startsWith('http') ? item.endpoint : `http://${item.endpoint}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-blue-600 hover:text-blue-700 hover:underline bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100 transition-all flex items-center gap-1.5"
                              >
                                {item.endpoint}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <button 
                                onClick={() => handleCopy(item.endpoint, item.id + '-endpoint')}
                                className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              >
                                {copiedId === (item.id + '-endpoint') ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-400 font-mono">N/A</span>
                          )}
                        </div>
                        {item.address && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">IP Address:</span>
                            <code className="text-[10px] font-mono text-slate-500">{item.address}:{item.port}</code>
                          </div>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                            <UserIcon className="w-3 h-3 text-slate-400" />
                          </div>
                          <span className="text-[12px] font-medium text-slate-600">{item.requestedBy || 'Unknown'}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => setViewingDetails(item)}
                            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Credentials"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button 
                                onClick={() => {
                                  setShowEditModal(item);
                                  setEditData({
                                    endpoint: item.endpoint || "",
                                    address: item.address || "",
                                    port: item.port || 22,
                                    username: item.username || "",
                                    password: item.password || "",
                                    status: item.status
                                  });
                                }}
                                className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Edit Configuration"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this service asset?")) {
                                    deleteMutation.mutate(item.id);
                                  }
                                }}
                                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Delete Asset"
                              >
                                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredItems.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
        {/* Edit Modal */}
        <AnimatePresence>
          {showEditModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20"
              >
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/20">
                      <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">Provisioning Config</h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{showEditModal.serviceName}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowEditModal(null)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">URL</label>
                      <div className="relative group">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <input 
                          type="text" 
                          className="input-field pl-12 w-full py-4 bg-slate-50 border-slate-200" 
                          placeholder="e.g. http://10.10.1.50:5678"
                          value={editData.endpoint}
                          onChange={e => setEditData({...editData, endpoint: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">IP Address</label>
                        <input 
                          type="text" 
                          className="input-field w-full py-4 bg-slate-50 border-slate-200" 
                          placeholder="10.10.1.50"
                          value={editData.address}
                          onChange={e => setEditData({...editData, address: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Port</label>
                        <input 
                          type="number" 
                          className="input-field w-full py-4 bg-slate-50 border-slate-200" 
                          placeholder="5678"
                          value={editData.port}
                          onChange={e => setEditData({...editData, port: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Status Override</label>
                      <select 
                        className="input-field w-full py-4 bg-slate-50 border-slate-200 font-bold"
                        value={editData.status}
                        onChange={e => setEditData({...editData, status: e.target.value})}
                      >
                        <option value="PROVISIONING">PROVISIONING</option>
                        <option value="COMPLETED">COMPLETED / ACTIVE</option>
                        <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50">
                    <button 
                      onClick={() => updateMutation.mutate({ id: showEditModal.id, data: editData })}
                      disabled={updateMutation.isPending}
                      className="btn-primary w-full py-5 flex items-center justify-center gap-3 shadow-2xl shadow-blue-600/20"
                    >
                      {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                      <span className="font-bold text-[11px] uppercase tracking-widest">Update Service Asset</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* Detail Modal for Users */}
        <AnimatePresence>
          {viewingDetails && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20"
              >
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20">
                      <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">Access Credentials</h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{viewingDetails.serviceName}</p>
                    </div>
                  </div>
                  <button onClick={() => setViewingDetails(null)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-1 gap-5">
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL</span>
                        <button 
                          onClick={() => handleCopy(viewingDetails.endpoint || '', 'detail-endpoint')}
                          className="text-indigo-600 hover:text-indigo-700 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1"
                        >
                          {copiedId === 'detail-endpoint' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          Copy URL
                        </button>
                      </div>
                      <a 
                        href={viewingDetails.endpoint?.startsWith('http') ? viewingDetails.endpoint : `http://${viewingDetails.endpoint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-blue-600 hover:underline flex items-center gap-2 group"
                      >
                        {viewingDetails.endpoint || 'Not available'}
                        {viewingDetails.endpoint && <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </a>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">IP Address</span>
                        <p className="text-sm font-mono text-slate-900">{viewingDetails.address || '---'}</p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Port</span>
                        <p className="text-sm font-mono text-slate-900">{viewingDetails.port || '---'}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <UserIcon className="w-4 h-4 text-slate-400" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Username</span>
                            <span className="text-sm font-mono text-slate-900">{viewingDetails.username || '---'}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleCopy(viewingDetails.username || '', 'detail-user')}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                        >
                          {copiedId === 'detail-user' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="h-px bg-slate-200/50 mx-[-1.25rem]" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Lock className="w-4 h-4 text-slate-400" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</span>
                            <span className="text-sm font-mono text-slate-900">
                              {viewingDetails.password ? '••••••••' : '---'}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleCopy(viewingDetails.password || '', 'detail-pass')}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                        >
                          {copiedId === 'detail-pass' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                      Security Note: These credentials grant direct access to the backend resource. Keep them secure.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
