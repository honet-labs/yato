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
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle
} from "lucide-react";
import { exportToCSV } from "@/lib/csvHelper";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";


interface ServiceInventory {
  id: string;
  serviceName: string;
  version: string;
  environment: string;
  category?: string;
  tags?: string[];
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
  
  // Password verification states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedVerifyAttempts, setFailedVerifyAttempts] = useState(0);
  const [pendingRevealService, setPendingRevealService] = useState(null as ServiceInventory | null);
  const [revealedPasswords, setRevealedPasswords] = useState({} as Record<string, string>);
  const [showPassInDetail, setShowPassInDetail] = useState(false);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({
    serviceName: "",
    version: "1.0.0",
    environment: "Production",
    category: "",
    tags: [] as string[],
    endpoint: "",
    address: "",
    port: 3306,
    username: "",
    password: ""
  });
  
  const [editData, setEditData] = useState({
    endpoint: "",
    address: "",
    port: 22,
    username: "",
    password: "",
    category: "",
    tags: [] as string[],
    status: ""
  });

  const { isAdmin, permissions, isLoading: isAuthLoading } = useIsAdmin();
  const canView = isAdmin || permissions.includes("VIEW_SERVICE_INVENTORY") || permissions.includes("MANAGE_SERVICE_INVENTORY");
  const canEdit = isAdmin || permissions.includes("EDIT_SERVICE_INVENTORY") || permissions.includes("MANAGE_SERVICE_INVENTORY");
  const canAddService = isAdmin || permissions.includes("PROVISION_SERVICE");

  const { data: serviceTypes } = useQuery({
    queryKey: ["catalog", "SERVICE_TYPE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=SERVICE_TYPE");
      return response.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: (newService: any) => api.post("/service-inventory", newService),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-inventory"] });
      setIsAddModalOpen(false);
      setAddFormData({
        serviceName: "",
        version: "1.0.0",
        environment: "Production",
        category: "",
        tags: [],
        endpoint: "",
        address: "",
        port: 3306,
        username: "",
        password: ""
      });
    }
  });

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

  const handleViewServiceCredentials = (item: ServiceInventory) => {
    if (revealedPasswords[item.id]) {
      setViewingDetails({
        ...item,
        password: revealedPasswords[item.id]
      });
      setShowPassInDetail(false);
    } else {
      setPendingRevealService(item);
      setVerifyPassword("");
      setVerifyError("");
      setIsVerifyModalOpen(true);
    }
  };

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

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Service Assets...</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full border border-rose-500/30 flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500">You do not have permission to access the Service Assets.</p>
          <div className="pt-2">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          {canAddService && (
            <div className="flex gap-3">
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            </div>
          )}
        </header>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium" 
              placeholder="Search by service name or endpoint..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={handleExport}
            className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="bg-white border border-slate-50 rounded-2xl overflow-visible shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tags</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">IP Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Port</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Environment</th>
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
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-40" /></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-100 rounded-full w-20 mx-auto" /></td>
                    {isAdmin && <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>}
                    <td className="px-6 py-4"><div className="h-8 bg-slate-100 rounded-lg w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : paginatedItems?.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-24 text-center">
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.category ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                          {item.category}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.tags && item.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{item.tags.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.address ? (
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{item.address}</code>
                          <button 
                            onClick={() => handleCopy(item.address, item.id + '-address')}
                            className="p-1 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                          >
                            {copiedId === (item.id + '-address') ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.port ? (
                        <code className="text-[11px] font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{item.port}</code>
                      ) : (
                        <span className="text-slate-400 text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.endpoint ? (
                        <div className="flex items-center gap-2">
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
                            className="p-1 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                          >
                            {copiedId === (item.id + '-endpoint') ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">N/A</span>
                      )}
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
                            onClick={() => handleViewServiceCredentials(item)}
                            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Credentials"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
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
                                    category: item.category || "",
                                    tags: item.tags || [],
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
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Category</label>
                        <select 
                          className="input-field w-full py-3 bg-slate-50 border-slate-200 font-bold text-sm"
                          value={editData.category}
                          onChange={e => setEditData({...editData, category: e.target.value})}
                        >
                          <option value="">Select Category</option>
                          <option value="DATABASE">Database</option>
                          <option value="WEB_SERVER">Web Server</option>
                          <option value="MONITORING">Monitoring</option>
                          <option value="CONTAINER">Container</option>
                          <option value="CACHE">Cache</option>
                          <option value="MESSAGE_QUEUE">Message Queue</option>
                          <option value="STORAGE">Storage</option>
                          <option value="NETWORK">Network</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Status</label>
                        <select 
                          className="input-field w-full py-3 bg-slate-50 border-slate-200 font-bold text-sm"
                          value={editData.status}
                          onChange={e => setEditData({...editData, status: e.target.value})}
                        >
                          <option value="PROVISIONING">PROVISIONING</option>
                          <option value="COMPLETED">COMPLETED / ACTIVE</option>
                          <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Tags</label>
                      <input 
                        type="text" 
                        className="input-field w-full py-3 bg-slate-50 border-slate-200 text-sm" 
                        placeholder="Comma-separated tags (e.g. production, critical, pci)"
                        value={editData.tags.join(', ')}
                        onChange={e => {
                          const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                          setEditData({...editData, tags});
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">URL</label>
                      <div className="relative group">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <input 
                          type="text" 
                          className="input-field pl-12 w-full py-3 bg-slate-50 border-slate-200 text-sm" 
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
                          className="input-field w-full py-3 bg-slate-50 border-slate-200 text-sm" 
                          placeholder="10.10.1.50"
                          value={editData.address}
                          onChange={e => setEditData({...editData, address: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Port</label>
                        <input 
                          type="number" 
                          className="input-field w-full py-3 bg-slate-50 border-slate-200 text-sm" 
                          placeholder="5678"
                          value={editData.port}
                          onChange={e => setEditData({...editData, port: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Username</label>
                        <input 
                          type="text" 
                          className="input-field w-full py-3 bg-slate-50 border-slate-200 text-sm" 
                          placeholder="e.g. admin"
                          value={editData.username}
                          onChange={e => setEditData({...editData, username: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Password</label>
                        <input 
                          type="password" 
                          className="input-field w-full py-3 bg-slate-50 border-slate-200 text-sm" 
                          placeholder="••••••••"
                          value={editData.password}
                          onChange={e => setEditData({...editData, password: e.target.value})}
                        />
                      </div>
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
        
        {/* Add Service Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 overflow-y-auto py-12">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100"
              >
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-600/20">
                      <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">Add Service Asset</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Provision direct service inventory entry</p>
                    </div>
                  </div>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  addMutation.mutate(addFormData);
                }} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Service Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Service Identifier / Name</label>
                      <input 
                        type="text" 
                        required
                        className="input-field w-full py-2.5 text-sm" 
                        placeholder="e.g. Redis-Cache-01"
                        value={addFormData.serviceName}
                        onChange={e => setAddFormData({...addFormData, serviceName: e.target.value})}
                      />
                    </div>

                    {/* Environment */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Environment</label>
                      <select 
                        className="input-field w-full py-2.5 text-sm font-bold"
                        value={addFormData.environment}
                        onChange={e => setAddFormData({...addFormData, environment: e.target.value})}
                      >
                        <option value="Production">Production</option>
                        <option value="Staging">Staging</option>
                        <option value="Development">Development</option>
                      </select>
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                      <select 
                        className="input-field w-full py-2.5 text-sm font-bold"
                        value={addFormData.category}
                        onChange={e => setAddFormData({...addFormData, category: e.target.value})}
                      >
                        <option value="">Select Category</option>
                        <option value="DATABASE">Database</option>
                        <option value="WEB_SERVER">Web Server</option>
                        <option value="MONITORING">Monitoring</option>
                        <option value="CONTAINER">Container</option>
                        <option value="CACHE">Cache</option>
                        <option value="MESSAGE_QUEUE">Message Queue</option>
                        <option value="STORAGE">Storage</option>
                        <option value="NETWORK">Network</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    {/* Tags */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</label>
                      <input 
                        type="text" 
                        className="input-field w-full py-2.5 text-sm" 
                        placeholder="Comma-separated tags (e.g. production, critical, pci)"
                        value={addFormData.tags.join(', ')}
                        onChange={e => {
                          const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                          setAddFormData({...addFormData, tags});
                        }}
                      />
                    </div>



                    {/* Endpoint / URL */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endpoint / URL</label>
                      <input 
                        type="text" 
                        className="input-field w-full py-2.5 text-sm" 
                        placeholder="e.g. http://10.10.1.50:5678"
                        value={addFormData.endpoint}
                        onChange={e => setAddFormData({...addFormData, endpoint: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Connection details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">IP Address / Host</label>
                      <input 
                        type="text" 
                        className="input-field w-full py-2.5 text-sm" 
                        placeholder="e.g. 10.10.1.50"
                        value={addFormData.address}
                        onChange={e => setAddFormData({...addFormData, address: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Port</label>
                      <input 
                        type="number" 
                        className="input-field w-full py-2.5 text-sm" 
                        value={addFormData.port}
                        onChange={e => setAddFormData({...addFormData, port: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  {/* Credentials */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                      <input 
                        type="text" 
                        className="input-field w-full py-2.5 text-sm" 
                        placeholder="Username for service"
                        value={addFormData.username}
                        onChange={e => setAddFormData({...addFormData, username: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                      <input 
                        type="password" 
                        className="input-field w-full py-2.5 text-sm" 
                        placeholder="••••••••"
                        value={addFormData.password}
                        onChange={e => setAddFormData({...addFormData, password: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="w-1/2 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm text-slate-600 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={addMutation.isPending}
                      className="w-1/2 btn-primary flex items-center justify-center gap-2"
                    >
                      {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Save Service</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Detail Modal for Users */}
        <AnimatePresence>
          {viewingDetails && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80">
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
                              {viewingDetails.password 
                                ? (showPassInDetail ? viewingDetails.password : '••••••••') 
                                : '---'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setShowPassInDetail(!showPassInDetail)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                            title={showPassInDetail ? "Hide Password" : "Show Password"}
                          >
                            {showPassInDetail ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button 
                            onClick={() => handleCopy(viewingDetails.password || '', 'detail-pass')}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                            title="Copy Password"
                          >
                            {copiedId === 'detail-pass' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
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

        {/* Identity Verification Modal */}
        <AnimatePresence>
          {isVerifyModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm border border-slate-100"
              >
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
                    <ShieldCheck className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Identity Verification</h3>
                  <p className="text-[11px] font-medium text-slate-400 mb-6">
                    Enter your account password to reveal this secret
                  </p>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!verifyPassword.trim()) return;
                    if (!pendingRevealService) return;

                    setIsVerifying(true);
                    setVerifyError("");
                    try {
                      const res = await api.post(`/service-inventory/${pendingRevealService.id}/reveal`, { password: verifyPassword });
                      
                      setRevealedPasswords(prev => ({
                        ...prev,
                        [pendingRevealService.id]: res.data.password
                      }));
                      setIsVerifyModalOpen(false);
                      setVerifyPassword("");
                      setFailedVerifyAttempts(0);
                      
                      setViewingDetails({
                        ...pendingRevealService,
                        password: res.data.password
                      });
                      setShowPassInDetail(false);
                    } catch (err: any) {
                      const nextAttempts = failedVerifyAttempts + 1;
                      setFailedVerifyAttempts(nextAttempts);
                      
                      if (nextAttempts >= 3) {
                        setFailedVerifyAttempts(0);
                        setIsVerifyModalOpen(false);
                        localStorage.removeItem("yato_token");
                        window.location.href = "/login";
                      } else {
                        const attemptsRemaining = 3 - nextAttempts;
                        setVerifyError(`Invalid password. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining before logout.`);
                      }
                    } finally {
                      setIsVerifying(false);
                    }
                  }} className="space-y-4">
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="password"
                        autoFocus
                        required
                        placeholder="Enter your password..."
                        value={verifyPassword}
                        onChange={(e) => { setVerifyPassword(e.target.value); setVerifyError(""); }}
                        className={cn(
                          "input-field pl-12 w-full py-3 bg-slate-50/50 font-medium text-center",
                          verifyError && "!border-red-300 !ring-red-100"
                        )}
                        autoComplete="current-password"
                      />
                    </div>
                    
                    {verifyError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-red-600 text-[11px] font-bold bg-red-50 px-4 py-2.5 rounded-xl border border-red-100"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {verifyError}
                      </motion.div>
                    )}
                    
                    <div className="flex gap-3 pt-2">
                      <button 
                        type="button"
                        onClick={() => { setIsVerifyModalOpen(false); setVerifyPassword(""); setVerifyError(""); }}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={isVerifying || !verifyPassword.trim()}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        <span className="text-[11px] font-bold uppercase tracking-wider">Verify & Reveal</span>
                      </button>
                    </div>
                  </form>
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

