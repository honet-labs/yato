"use client";
import { PageHeader } from "@/components/PageHeader";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Pagination } from "@/components/Pagination";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Loader2, 
  Plus, 
  CheckCircle2, 
  Settings, 
  Trash2, 
  X, 
  Copy, 
  Check, 
  Globe, 
  User as UserIcon,
  Activity,
  Download,
  QrCode,
  Printer,
  Link as LinkIcon,
  Database,
  Cpu,
  MapPin,
  Tag,
  Eye,
  ChevronDown
} from "lucide-react";
import { exportToExcel } from "@/lib/excelHelper";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useIsAdmin } from "@/hooks/useIsAdmin";


interface Asset {
  id: string;
  assetCode: string;
  assetType: string;
  hostname?: string;
  serialNumber?: string;
  status: string;
  location?: string;
  rack?: string;
  uPosition?: number;
  qrCodeUrl?: string;
  healthStatus: string;
  uptime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  createdAt: string;
  owner?: {
    id: string;
    fullName: string;
    email: string;
  };
  metadata?: any;
}

export default function AssetsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("");
  const [activeMenu, setActiveMenu] = useState(null as string | null);
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRelationshipOpen, setIsRelationshipOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null as Asset | null);
  const [qrZoomAsset, setQrZoomAsset] = useState(null as Asset | null);
  
  const [isCopied, setIsCopied] = useState(false);

  const [formData, setFormData] = useState({
    assetType: "",
    hostname: "",
    serialNumber: "",
    status: "RECEIVED",
    location: "",
    rack: "",
    uPosition: 1,
    ownerId: "",
    metadata: {},
  } as any);

  const [relData, setRelData] = useState({
    targetId: "",
    type: "VM_TO_HYPERVISOR",
  });


  const { data: assetTypes } = useQuery({
    queryKey: ["catalog", "PHYSICAL_ASSET_TYPE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=PHYSICAL_ASSET_TYPE");
      return response.data;
    },
  });

  const { isAdmin, permissions: userPermissions } = useIsAdmin();
  const canManageAssets = isAdmin || userPermissions.includes("MANAGE_ASSETS");

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", search],
    queryFn: async () => {
      const response = await api.get("/assets", {
        params: { search }
      });
      return response.data;
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-users-list"],
    queryFn: async () => {
      const response = await api.get("/users"); // Assuming standard users list endpoint exists
      return response.data;
    },
    enabled: isCreateOpen || isEditOpen,
  });

  // Queries for relationships
  const { data: relationships } = useQuery({
    queryKey: ["asset-relationships", selectedAsset?.id],
    queryFn: async () => {
      const response = await api.get(`/assets/${selectedAsset?.id}/relationship`);
      return response.data;
    },
    enabled: !!selectedAsset && isRelationshipOpen,
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post("/assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => api.put(`/assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setIsEditOpen(false);
      setSelectedAsset(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setActiveMenu(null);
    },
  });

  const addRelMutation = useMutation({
    mutationFn: (data: { sourceId: string; targetId: string; type: string }) => 
      api.post("/assets/relationship", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-relationships"] });
      setRelData({ targetId: "", type: "VM_TO_HYPERVISOR" });
    },
  });

  const deleteRelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/relationship/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-relationships"] });
    },
  });

  const resetForm = () => {
    setFormData({
      assetType: "",
      hostname: "",
      serialNumber: "",
      status: "RECEIVED",
      location: "",
      rack: "",
      uPosition: 1,
      ownerId: "",
      metadata: {},
    });
  };

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      assetType: asset.assetType,
      hostname: asset.hostname || "",
      serialNumber: asset.serialNumber || "",
      status: asset.status,
      location: asset.location || "",
      rack: asset.rack || "",
      uPosition: asset.uPosition || 1,
      ownerId: asset.owner?.id || "",
      metadata: asset.metadata || {},
    });
    setIsEditOpen(true);
    setActiveMenu(null);
  };

  const filteredAssets = assets?.filter((asset: any) => {
    if (selectedTypeFilter && asset.assetType !== selectedTypeFilter) {
      return false;
    }
    return true;
  }) || [];

  const handleExport = () => {
    if (filteredAssets.length === 0) return;

    // Group assets by assetType to create separate sheets
    const assetsGroupedByType: Record<string, any[]> = {};

    filteredAssets.forEach(asset => {
      const type = asset.assetType || 'Other';
      if (!assetsGroupedByType[type]) {
        assetsGroupedByType[type] = [];
      }

      const baseData: any = {
        'Asset ID': asset.assetCode,
        'Asset Type': asset.assetType,
        'Asset Name': asset.hostname || 'N/A',
        'Description': asset.metadata?.description || 'N/A',
        'Notes': asset.metadata?.notes || 'N/A',
        'Owner': asset.owner?.fullName || 'N/A',
        'Status': asset.status
      };

      // Dynamically add custom metadata fields, excluding standard description and notes
      if (asset.metadata && typeof asset.metadata === 'object') {
        Object.entries(asset.metadata).forEach(([key, val]) => {
          if (key !== 'description' && key !== 'notes') {
            baseData[key] = val !== null && val !== undefined ? String(val) : 'N/A';
          }
        });
      }

      assetsGroupedByType[type].push(baseData);
    });

    const sheets = Object.entries(assetsGroupedByType).map(([typeName, data]) => ({
      name: typeName,
      data
    }));

    // Record audit event to backend
    api.post('/assets/export/log', { count: filteredAssets.length }).catch(err => {
      console.error('Failed to log excel export to audit log:', err);
    });

    const filenameSuffix = selectedTypeFilter ? `_${selectedTypeFilter}` : '_All';
    exportToExcel(sheets, `YATO_Asset_Registry${filenameSuffix}`);
  };

  const printLabel = async (id: string) => {
    const token = localStorage.getItem("yato_token") || "";
    try {
      const res = await fetch(`/api/assets/${id}/print`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch label");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank', 'width=600,height=400');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          URL.revokeObjectURL(url);
        };
      }
    } catch (err) {
      console.error("Print failed:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const totalPages = Math.ceil((filteredAssets.length || 0) / itemsPerPage);
  const paginatedAssets = filteredAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  ) || [];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar p-8 flex-1">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <PageHeader title="Asset Registry" subtitle="Globally unique identities, printable labels, and lifecycle placement tracking" />
            </div>
            
            {canManageAssets && (
              <button 
                onClick={() => { resetForm(); setIsCreateOpen(true); }}
                className="btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/10 sm:self-center self-start shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add Physical Asset
              </button>
            )}
          </header>

          {/* Quick Metrics Widget */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Assets</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{assets?.length || 0}</h3>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Active State</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                  {assets?.filter(a => a.status === 'ACTIVE').length || 0}
                </h3>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">In Maintenance</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                  {assets?.filter(a => a.status === 'MAINTENANCE').length || 0}
                </h3>
              </div>
            </div>
          </div>

          {/* Filter and Tool Bar */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-grow">
              {/* Search */}
              <div className="relative group flex-grow max-w-md">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input 
                  type="text" 
                  className="bg-slate-50 hover:bg-slate-100/50 border border-slate-200/80 rounded-xl pl-11 pr-4 py-2.5 text-sm w-full focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all shadow-inner" 
                  placeholder="Search code, host, SN..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Type Filter */}
              <div className="relative shrink-0">
                <select
                  className="bg-slate-50 hover:bg-slate-100/50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all cursor-pointer appearance-none pr-10 text-slate-600 w-full sm:w-auto"
                  value={selectedTypeFilter}
                  onChange={(e) => {
                    setSelectedTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">All Asset Types</option>
                  {assetTypes?.map(t => (
                    <option key={t.id} value={t.value}>{t.name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end shrink-0">
              <Link 
                href="/assets/scanner"
                className="btn-secondary flex items-center gap-2 shadow-sm py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-200/80"
              >
                <QrCode className="w-4 h-4 text-indigo-500" />
                Audit Scanner
              </Link>

              <button 
                onClick={handleExport}
                className="btn-secondary flex items-center gap-2 shadow-sm py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-200/80"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                Export Excel
              </button>
            </div>
          </div>

          {/* Main asset table */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-visible">
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assets Type</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assets Name</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Owner</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Notes</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={8} className="px-6 py-8 h-20 bg-slate-50/10"></td>
                      </tr>
                    ))
                  ) : paginatedAssets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-20 text-center text-slate-400 font-medium">
                        No physical assets found in registry.
                      </td>
                    </tr>
                  ) : paginatedAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                           <button 
                             onClick={() => setQrZoomAsset(asset)}
                             className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-700 hover:bg-slate-100 transition-all shadow-sm group relative"
                             title="Show QR Code"
                           >
                             <QrCode className="w-5 h-5 group-hover:scale-110 transition-transform" />
                           </button>
                           <span className="font-bold text-slate-900 text-[13px]">{asset.assetCode}</span>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span className="text-[9px] font-extrabold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md uppercase tracking-wider">
                          {asset.assetType}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span className="text-[13px] font-bold text-slate-700">{asset.hostname || 'UNASSIGNED_NAME'}</span>
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-[12px] text-slate-500 max-w-[200px] truncate font-medium" title={asset.metadata?.description}>
                          {asset.metadata?.description || '-'}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5 uppercase">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            {asset.owner?.fullName || 'YATO Shared'}
                          </span>
                          {asset.owner?.email && (
                            <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                              {asset.owner.email}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-[12px] text-slate-500 max-w-[200px] truncate font-medium" title={asset.metadata?.notes}>
                          {asset.metadata?.notes || '-'}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border shadow-sm",
                          asset.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          asset.status === 'MAINTENANCE' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          asset.status === 'BROKEN' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                        )}>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            asset.status === 'ACTIVE' ? "bg-emerald-500" :
                            asset.status === 'MAINTENANCE' ? "bg-amber-500" :
                            asset.status === 'BROKEN' ? "bg-rose-500" :
                            "bg-slate-400"
                          )} />
                          {asset.status}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right relative">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setSelectedAsset(asset); setIsViewOpen(true); }}
                            className="p-2 rounded-lg transition-all hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                            title="View Asset Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === asset.id ? null : asset.id);
                            }}
                            className={cn(
                              "p-2 rounded-lg transition-all hover:bg-slate-100 relative z-20 text-slate-400",
                              activeMenu === asset.id && "bg-slate-100 text-blue-600"
                            )}
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>

                        <AnimatePresence>
                          {activeMenu === asset.id && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute right-6 top-[80%] w-48 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-[100]"
                            >
                              <button 
                                onClick={() => { setSelectedAsset(asset); setIsViewOpen(true); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-all"
                              >
                                <Eye className="w-4 h-4 text-slate-400" />
                                VIEW DETAILS
                              </button>
                              <button 
                                onClick={() => { printLabel(asset.id); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-all"
                              >
                                <Printer className="w-4 h-4 text-slate-400" />
                                PRINT QR LABEL
                              </button>
                              <button 
                                onClick={() => { setSelectedAsset(asset); setIsRelationshipOpen(true); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-all"
                              >
                                <LinkIcon className="w-4 h-4 text-slate-400" />
                                CMDB RELATIONS
                              </button>
                              {canManageAssets && (
                                <>
                                  <button 
                                    onClick={() => handleEdit(asset)}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-all"
                                  >
                                    <Settings className="w-4 h-4 text-slate-400" />
                                    EDIT ASSET
                                  </button>
                                  <div className="h-px bg-slate-50 my-1" />
                                  <button 
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to retire asset ${asset.assetCode}?`)) {
                                        deleteMutation.mutate(asset.id);
                                      }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    RETIRE / DELETE
                                  </button>
                                </>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={assets?.length || 0}
              itemsPerPage={itemsPerPage}
            />
          </div>
        </main>
      </div>

      {/* QR ZOOM OVERLAY MODAL */}
      <AnimatePresence>
        {qrZoomAsset && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full border border-slate-100 flex flex-col items-center justify-center shadow-2xl text-center relative"
            >
              <button 
                onClick={() => setQrZoomAsset(null)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-xl transition-all"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
              <h3 className="text-xl font-bold text-slate-900 mt-2">{qrZoomAsset.assetCode}</h3>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-extrabold mt-1">{qrZoomAsset.assetType}</p>
              
              <div className="w-56 h-56 mt-6 border border-slate-100 rounded-2xl p-4 bg-slate-50 flex items-center justify-center shadow-inner">
                {qrZoomAsset.qrCodeUrl ? (
                  <img src={qrZoomAsset.qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-20 h-20 text-slate-200 animate-pulse" />
                )}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 w-full">
                <button 
                  onClick={() => printLabel(qrZoomAsset.id)}
                  className="py-3 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print Label
                </button>
                <button 
                  onClick={() => copyToClipboard(qrZoomAsset.assetCode)}
                  className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/10"
                >
                  <Copy className="w-4 h-4" /> Copy Code
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE & EDIT ASSET MODAL */}
      <AnimatePresence>
        {(isCreateOpen || isEditOpen) && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/20">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{isEditOpen ? "Modify Asset Record" : "Register Physical Asset"}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Secure physical asset tracking</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); setSelectedAsset(null); }}
                  className="p-3 bg-white hover:bg-slate-100 rounded-2xl transition-all shadow-sm border border-slate-100"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isEditOpen && selectedAsset) {
                    updateMutation.mutate({ id: selectedAsset.id, data: formData });
                  } else {
                    addMutation.mutate(formData);
                  }
                }}
                className="flex flex-col flex-1 overflow-hidden"
              >
                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    
                    <div className="space-y-2 col-span-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" /> Physical Asset Type
                      </label>
                      <select 
                        required
                        className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl appearance-none font-bold"
                        value={formData.assetType ? formData.assetType.toUpperCase() : ""}
                        onChange={(e) => setFormData({...formData, assetType: e.target.value.toUpperCase()})}
                      >
                        <option value="">Select type...</option>
                        {assetTypes?.map(t => (
                          <option key={t.id} value={t.value.toUpperCase()}>{t.name} ({t.value.toUpperCase()})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Asset Name</label>
                      <input 
                        type="text" 
                        required
                        className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl px-4" 
                        placeholder="e.g. Switch Core 1"
                        value={formData.hostname}
                        onChange={(e) => setFormData({...formData, hostname: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Description</label>
                      <textarea 
                        className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-xs font-semibold animate-pulse-once" 
                        placeholder="Enter asset description or purpose..."
                        rows={2}
                        value={formData.metadata?.description || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          metadata: {
                            ...formData.metadata,
                            description: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Notes</label>
                      <textarea 
                        className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-xs font-semibold animate-pulse-once" 
                        placeholder="Enter any additional notes..."
                        rows={2}
                        value={formData.metadata?.notes || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          metadata: {
                            ...formData.metadata,
                            notes: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Owner</label>
                      <select 
                        className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl appearance-none font-bold"
                        value={formData.ownerId}
                        onChange={(e) => setFormData({...formData, ownerId: e.target.value})}
                      >
                        <option value="">No Owner (YATO Infrastructure Shared)</option>
                        {allUsers?.map((user: any) => (
                          <option key={user.id} value={user.id}>{user.fullName} ({user.email})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Status</label>
                      <select 
                        required
                        className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl appearance-none font-bold"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                      >
                        <option value="PROCUREMENT">PROCUREMENT</option>
                        <option value="RECEIVED">RECEIVED</option>
                        <option value="READY">READY</option>
                        <option value="ASSIGNED">ASSIGNED</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="BROKEN">BROKEN</option>
                        <option value="RETIRED">RETIRED</option>
                        <option value="DISPOSED">DISPOSED</option>
                      </select>
                    </div>

                    {/* Dynamic Custom Fields injection */}
                    {(() => {
                      const selectedTypeObj = assetTypes?.find(t => t.value === formData.assetType);
                      const customFields = selectedTypeObj?.metadata?.customFields || [];
                      if (customFields.length === 0) return null;
                      return (
                        <div className="col-span-2 space-y-4 pt-5 border-t border-slate-100/80 mt-2">
                          <p className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" /> {selectedTypeObj?.name} Properties
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            {customFields.map((field: any) => {
                              const value = formData.metadata?.[field.name];
                              const isRequired = field.isRequired;
                              
                              return (
                                <div key={field.name} className="space-y-2">
                                  <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    {field.name} {isRequired && <span className="text-red-500 font-extrabold">*</span>}
                                  </label>
                                  
                                  {field.type === "boolean" ? (
                                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 shadow-sm h-[42px] transition-all hover:bg-slate-100/30">
                                      <input 
                                        type="checkbox"
                                        className="accent-blue-600 rounded w-4 h-4 cursor-pointer"
                                        checked={!!value}
                                        onChange={e => {
                                          setFormData({
                                            ...formData,
                                            metadata: {
                                              ...formData.metadata,
                                              [field.name]: e.target.checked
                                            }
                                          });
                                        }}
                                      />
                                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Yes / Enabled</span>
                                    </label>
                                  ) : field.type === "datetime" ? (
                                    <input 
                                      type="datetime-local"
                                      required={isRequired}
                                      className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-xs font-semibold focus:border-blue-500 transition-all outline-none"
                                      value={value || ""}
                                      onChange={e => {
                                        setFormData({
                                          ...formData,
                                          metadata: {
                                            ...formData.metadata,
                                            [field.name]: e.target.value
                                          }
                                        });
                                      }}
                                    />
                                  ) : field.type === "number" ? (
                                    <input 
                                      type="number"
                                      required={isRequired}
                                      className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-xs font-semibold focus:border-blue-500 transition-all outline-none"
                                      placeholder={`Enter ${field.name}...`}
                                      value={value || ""}
                                      onChange={e => {
                                        setFormData({
                                          ...formData,
                                          metadata: {
                                            ...formData.metadata,
                                            [field.name]: parseFloat(e.target.value) || e.target.value
                                          }
                                        });
                                      }}
                                    />
                                  ) : field.type === "password" ? (
                                    <input 
                                      type="password"
                                      required={isRequired}
                                      className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-xs font-semibold focus:border-blue-500 transition-all outline-none font-mono"
                                      placeholder={`Enter ${field.name}...`}
                                      value={value || ""}
                                      onChange={e => {
                                        setFormData({
                                          ...formData,
                                          metadata: {
                                            ...formData.metadata,
                                            [field.name]: e.target.value
                                          }
                                        });
                                      }}
                                    />
                                  ) : (
                                    <input 
                                      type="text"
                                      required={isRequired}
                                      className="input-field w-full py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-xs font-semibold focus:border-blue-500 transition-all outline-none"
                                      placeholder={`Enter ${field.name}...`}
                                      value={value || ""}
                                      onChange={e => {
                                        setFormData({
                                          ...formData,
                                          metadata: {
                                            ...formData.metadata,
                                            [field.name]: e.target.value
                                          }
                                        });
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>

                <div className="p-8 pt-6 border-t border-slate-50 shrink-0 bg-white z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                  <button 
                    type="submit" 
                    disabled={addMutation.isPending || updateMutation.isPending}
                    className="btn-primary w-full flex items-center justify-center gap-3"
                  >
                    {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    <span>{isEditOpen ? "Update Asset Identity" : "Generate Secure Identity Label"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW ASSET DETAILS MODAL */}
      <AnimatePresence>
        {isViewOpen && selectedAsset && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full border border-slate-100 flex flex-col max-h-[85vh] shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => { setIsViewOpen(false); setSelectedAsset(null); }}
                className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-lg tracking-tight">{selectedAsset.assetCode}</span>
                    <span className="text-[10px] font-extrabold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-100 uppercase tracking-widest">
                      {selectedAsset.assetType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Asset Identity Details</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                {/* Core Properties Card */}
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Asset Name</span>
                    <span className="text-sm font-bold text-slate-800">{selectedAsset.hostname || 'N/A'}</span>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Description</span>
                    <span className="text-sm font-bold text-slate-800 leading-relaxed block bg-white border border-slate-100 rounded-xl p-3 mt-1 whitespace-pre-wrap">
                      {selectedAsset.metadata?.description || 'No description provided.'}
                    </span>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Notes</span>
                    <span className="text-sm font-bold text-slate-800 leading-relaxed block bg-white border border-slate-100 rounded-xl p-3 mt-1 whitespace-pre-wrap">
                      {selectedAsset.metadata?.notes || 'No notes provided.'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Owner / Person in Charge</span>
                    <span className="text-sm font-bold text-slate-800 block mt-1">{selectedAsset.owner?.fullName || 'YATO Shared'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Status</span>
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase tracking-widest border shadow-sm bg-white mt-1">
                        {selectedAsset.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Custom Metadata Fields */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Custom Field Properties</h4>
                  {selectedAsset.metadata && Object.keys(selectedAsset.metadata).filter(k => k !== 'description' && k !== 'notes').length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(selectedAsset.metadata)
                        .filter(([key]) => key !== 'description' && key !== 'notes')
                        .map(([key, val]: any) => (
                        <div key={key} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-1">
                          <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-widest">{key}</span>
                          <span className="text-xs font-bold text-slate-800">
                            {typeof val === 'boolean' ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${val ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                {val ? 'YES' : 'NO'}
                              </span>
                            ) : (
                              val || 'N/A'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-slate-100 border-dashed rounded-3xl text-center text-xs text-slate-400 font-semibold">
                      No custom field values filled for this asset.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => { setIsViewOpen(false); setSelectedAsset(null); }}
                  className="btn-secondary px-6"
                >
                  Close Window
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RELATIONSHIPS (CMDB TOPOLOGY) MODAL */}
      <AnimatePresence>
        {isRelationshipOpen && selectedAsset && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full border border-slate-100 flex flex-col max-h-[85vh] shadow-2xl relative"
            >
              <button 
                onClick={() => { setIsRelationshipOpen(false); setSelectedAsset(null); }}
                className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-xl transition-all"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
              
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-indigo-500" />
                CMDB Relationships Topology
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Asset: {selectedAsset.assetCode} ({selectedAsset.hostname})</p>

              {/* Add relationship form */}
              {isAdmin && (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    addRelMutation.mutate({
                      sourceId: selectedAsset.id,
                      targetId: relData.targetId,
                      type: relData.type
                    });
                  }}
                  className="mt-6 p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row items-end gap-3"
                >
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Target Related Asset</label>
                    <select 
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      value={relData.targetId}
                      onChange={(e) => setRelData({...relData, targetId: e.target.value})}
                    >
                      <option value="">Select Asset...</option>
                      {assets?.filter(a => a.id !== selectedAsset.id).map(a => (
                        <option key={a.id} value={a.id}>{a.assetCode} - {a.hostname || 'Shared'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Relation Type</label>
                    <select 
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                      value={relData.type}
                      onChange={(e) => setRelData({...relData, type: e.target.value})}
                    >
                      <option value="VM_TO_HYPERVISOR">VM TO HYPERVISOR (VM -&gt; Host)</option>
                      <option value="SERVER_TO_RACK">SERVER TO RACK (Server -&gt; Rack)</option>
                      <option value="SWITCH_TO_DATACENTER">SWITCH TO DATACENTER (Switch -&gt; DC)</option>
                      <option value="SERVICE_TO_DATABASE">SERVICE TO DATABASE (App -&gt; DB)</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    disabled={addRelMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold uppercase shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 transition-all shrink-0"
                  >
                    {addRelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add relation
                  </button>
                </form>
              )}

              {/* Relationships list */}
              <div className="mt-8 flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Connected Nodes</p>
                {relationships?.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-10 text-center">No topological mappings generated for this asset node.</p>
                ) : relationships?.map((rel: any) => {
                  const isSource = rel.sourceId === selectedAsset.id;
                  const partner = isSource ? rel.target : rel.source;
                  return (
                    <div key={rel.id} className="p-4 bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-sm rounded-xl flex items-center justify-between transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                          <LinkIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            {isSource ? 'Outbound:' : 'Inbound:'} {rel.type}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                            Partner Node: {partner.assetCode} ({partner.hostname || 'Shared'})
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <button 
                          onClick={() => {
                            if (confirm('Delete this CMDB relationship link?')) {
                              deleteRelMutation.mutate(rel.id);
                            }
                          }}
                          className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
                <Link
                  href="/assets/relationships"
                  className="py-3 px-5 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
                >
                  <Globe className="w-4 h-4 text-indigo-500" />
                  Launch CMDB Topology Mapper
                </Link>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCopied && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[300] flex items-center gap-3 border border-white/10"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest">Copied to clipboard</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
