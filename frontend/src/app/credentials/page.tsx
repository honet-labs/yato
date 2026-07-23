"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Pagination } from "@/components/Pagination";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { PageHeader } from "@/components/PageHeader";
import { SecurePasswordDisplay } from "@/components/SecurePasswordDisplay";
import { 
  Key, 
  Plus, 
  Search, 
  Shield, 
  Trash2, 
  Loader2, 
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  ExternalLink,
  Globe,
  Tag,
  Hash,
  ChevronDown,
  Edit3,
  AlertTriangle,
  ShieldCheck,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Credential {
  id: string;
  name: string;
  username?: string;
  address?: string;
  password?: string;
  description?: string;
  metadata?: Record<string, any>;
  type: string;
  tags: string[];
  createdAt: string;
}

export default function CredentialsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCred, setSelectedCred] = useState(null as Credential | null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [credToDelete, setCredToDelete] = useState(null as string | null);
  
  const [showPassInForm, setShowPassInForm] = useState(false);
  const [showPassInDetail, setShowPassInDetail] = useState(false);
  const [copiedField, setCopiedField] = useState(null as string | null);
  const [revealedPasswords, setRevealedPasswords] = useState({} as Record<string, string>);
  
  // Password verification state for revealing secrets
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyPurpose, setVerifyPurpose] = useState("REVEAL" as "REVEAL" | "EXPORT" | "EDIT");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingRevealCredId, setPendingRevealCredId] = useState(null as string | null);
  const [pendingEditCred, setPendingEditCred] = useState(null as Credential | null);
  const [failedVerifyAttempts, setFailedVerifyAttempts] = useState(0);
  
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    address: "",
    password: "",
    description: "",
    type: "SSH Key",
    tags: [] as string[],
    metadata: {} as Record<string, any>
  });

  const { data: credentials, isLoading } = useQuery({
    queryKey: ["credentials"],
    queryFn: async () => {
      const response = await api.get("/credentials/");
      return response.data;
    },
  });

  const { data: allTags } = useQuery({
    queryKey: ["credential-tags"],
    queryFn: async () => {
      const response = await api.get("/credentials/tags");
      return response.data;
    },
  });

  // Fetch Identity Types from Catalog
  const { data: identityTypes } = useQuery({
    queryKey: ["catalog", "IDENTITY_TYPE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=IDENTITY_TYPE");
      return response.data.length > 0 ? response.data : [
        { name: "SSH Key", value: "SSH Key", metadata: { customFields: [] } },
        { name: "API Token", value: "API Token", metadata: { customFields: [] } },
        { name: "Database Pass", value: "Database Pass", metadata: { customFields: [] } },
        { name: "Cloud Secret", value: "Cloud Secret", metadata: { customFields: [] } }
      ];
    },
  });

  const addMutation = useMutation({
    mutationFn: (newCred: any) => api.post("/credentials/", newCred),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      queryClient.invalidateQueries({ queryKey: ["credential-tags"] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/credentials/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      queryClient.invalidateQueries({ queryKey: ["credential-tags"] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/credentials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      setIsDeleteModalOpen(false);
      setCredToDelete(null);
    },
  });

  const resetForm = () => {
    setFormData({ 
      name: "", 
      username: "", 
      address: "", 
      password: "", 
      description: "",
      type: identityTypes?.[0]?.value || "SSH Key", 
      tags: [],
      metadata: {}
    });
    setIsEditMode(false);
    setSelectedCred(null);
  };

  const handleEdit = (cred: Credential) => {
    setSelectedCred(cred);
    setFormData({
      name: cred.name,
      username: cred.username || "",
      address: cred.address || "",
      description: cred.description || "",
      password: cred.password ? "****************" : "", // Masked on edit unless changed
      type: cred.type,
      tags: cred.tags,
      metadata: cred.metadata || {}
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

const handleView = (cred: Credential) => {
  setSelectedCred(cred);
  const revealed = revealedPasswords[cred.id];
  if (revealed) {
    setShowPassInDetail(true);
    setIsDetailOpen(true);
  } else {
    setPendingRevealCredId(cred.id);
    setVerifyPassword("");
    setVerifyError("");
    setVerifyPurpose("REVEAL");
    setIsVerifyModalOpen(true);
  }
};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode && selectedCred) {
      updateMutation.mutate({ id: selectedCred.id, data: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const handleAddTag = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase();
    if (cleanTag && !formData.tags.includes(cleanTag)) {
      setFormData({ ...formData, tags: [...formData.tags, cleanTag] });
    }
    setTagInput("");
    setShowTagSuggestions(false);
  };

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filteredCredentials = credentials?.filter(cred => {
    const s = search.toLowerCase();
    const matchesSearch = (
      (cred.name?.toLowerCase() || "").includes(s) ||
      (cred.username?.toLowerCase() || "").includes(s) ||
      (cred.address?.toLowerCase() || "").includes(s) ||
      (cred.tags?.some(t => t.toLowerCase().includes(s)) || false)
    );
    const matchesTab = activeTab === "All" || cred.type === activeTab;
    return matchesSearch && matchesTab;
  }) || [];

  const totalPages = Math.ceil(filteredCredentials.length / itemsPerPage);
  const paginatedCredentials = filteredCredentials.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const filteredTags = allTags?.filter(t => 
    t.toLowerCase().includes(tagInput.toLowerCase()) && !formData.tags.includes(t)
  );

  const handleExportToExcel = () => {
    if (!credentials || credentials.length === 0) {
      alert("No credentials in vault to export.");
      return;
    }

    // Group credentials by type (identity type)
    const grouped: Record<string, Credential[]> = {};
    credentials.forEach(cred => {
      const type = cred.type || "Other";
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(cred);
    });

    // Helper to sanitize XML characters
    const escapeXml = (unsafe: string) => {
      if (!unsafe) return "";
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>YATO Credential Vault</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4F81BD" ss:Pattern="Solid"/>
  </Style>
 </Styles>`;

    Object.entries(grouped).forEach(([type, list]) => {
      // Worksheet name length is max 31 characters in Excel and cannot contain special characters
      const sheetName = escapeXml(type.substring(0, 30).replace(/[:\\/?*\[\]]/g, ""));
      xml += `\\n <Worksheet ss:Name="${sheetName}">
  <Table>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Credential Label</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Target IP / Domain / Service</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Identity Type</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Username / ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tags</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Created At</Data></Cell>
   </Row>`;

      list.forEach(cred => {
        xml += `\\n   <Row>
    <Cell><Data ss:Type="String">${escapeXml(cred.name)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(cred.address || "")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(cred.type)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(cred.username || "")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(cred.description || "")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(cred.tags?.join(", ") || "")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(new Date(cred.createdAt).toLocaleString())}</Data></Cell>
   </Row>`;
      });

      xml += `\\n  </Table>
 </Worksheet>`;
    });

    xml += `\\n</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yato_credentials_export_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-background font-sans text-[13px]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <PageHeader title="Credential Vault" subtitle="Secure identity and resource access management" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="btn-primary flex items-center justify-center gap-2.5 px-6 shadow-xl shadow-blue-600/20 animate-fade-in"
            >
              <Plus className="w-5 h-5" />
              <span className="font-bold uppercase tracking-widest text-[11px]">Add Security Secret</span>
            </button>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium" 
              placeholder="Search by name, user, IP or resource..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setVerifyPurpose("EXPORT");
              setVerifyPassword("");
              setVerifyError("");
              setIsVerifyModalOpen(true);
            }}
            className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            title="Export Vault details into multi-sheet Excel file"
          >
            <Download className="w-4 h-4" />
            Export Vault
          </button>
        </div>

        {/* Identity Type Dropdown Filter */}
        <div className="relative shrink-0 mb-8 max-w-max">
          <select
            className="bg-slate-50 hover:bg-slate-100/50 border border-slate-200/80 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all cursor-pointer appearance-none pr-10 text-slate-700 shadow-sm"
            value={activeTab}
            onChange={(e) => {
              setActiveTab(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="All">All Identity Types</option>
            {identityTypes?.map((t: any) => (
              <option key={t.id} value={t.value}>{t.value}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-50 rounded-2xl overflow-visible shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resource Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identity / Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tags</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-40" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="px-6 py-4"><div className="h-8 bg-slate-100 rounded-lg w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : credentials?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <Key className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">No secrets found in vault</p>
                  </td>
                </tr>
              ) : (
                paginatedCredentials?.map((cred) => (
                  <tr key={cred.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-indigo-600" />
                        </div>
                        <p className="text-[13px] font-semibold text-slate-900">{cred.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <p className="text-[12px] font-medium text-slate-700">{cred.username}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{cred.type}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 group/link relative">
                        <Globe className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        {cred.address ? (
                          <>
                            <a 
                              href={cred.address.startsWith('http') ? cred.address : `http://${cred.address}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[12px] font-medium hover:text-blue-600 hover:underline transition-colors truncate max-w-[200px]"
                            >
                              {cred.address}
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(cred.address || "", `address-${cred.id}`);
                              }}
                              className="opacity-0 group-hover/link:opacity-100 p-1 bg-white hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-all ml-1 shadow-sm border border-slate-100"
                              title="Copy Address"
                            >
                              {copiedField === `address-${cred.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </>
                        ) : (
                          <span className="text-[12px] font-medium">---</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {cred.tags?.map(tag => (
                          <span key={tag} className="text-[9px] font-bold text-indigo-500 bg-indigo-50/50 border border-indigo-100/50 px-2 py-0.5 rounded uppercase tracking-tighter">#{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleView(cred)}
                          className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Verify & View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setPendingEditCred(cred);
                            setVerifyPurpose("EDIT");
                            setVerifyPassword("");
                            setVerifyError("");
                            setIsVerifyModalOpen(true);
                          }}
                          className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setCredToDelete(cred.id); setIsDeleteModalOpen(true); }}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
            totalItems={filteredCredentials.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </main>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto py-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0 rounded-t-[2.5rem]">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/20">
                    <Key className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{isEditMode ? "Edit Credential" : "Vault New Entry"}</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Secure sensitive information</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all shadow-sm bg-white">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden rounded-b-[2.5rem]">
                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label>Credential Label</label>
                    <input 
                      type="text" 
                      required
                      className="input-field w-full py-2.5 bg-slate-50/50" 
                      placeholder="e.g. Production AWS Key"
                      autoComplete="off"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label>Target IP / Domain / Service <span className="text-[10px] text-slate-400 font-normal ml-2">(Optional)</span></label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        className="input-field pl-12 w-full py-2.5 bg-slate-50/50" 
                        placeholder="e.g. 192.168.1.100 or db.prod.internal"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label>Identity Type</label>
                    <div className="relative group">
                      <select 
                        required
                        className="input-field appearance-none bg-slate-50/50 w-full pr-10 py-2.5 font-bold"
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value})}
                      >
                        {identityTypes?.map((t: any) => (
                          <option key={t.id || t.value} value={t.value}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label>Username / Identity ID <span className="text-[10px] text-slate-400 font-normal ml-2">(Optional)</span></label>
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        className="input-field pl-12 w-full py-2.5 bg-slate-50/50" 
                        placeholder="e.g. admin or api_user"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                      />
                    </div>
                  </div>



                  {/* Render Dynamic Custom Fields */}
                  {identityTypes?.find((t: any) => t.value === formData.type)?.metadata?.customFields?.map((field: any, idx: number) => {
                    const value = formData.metadata?.[field.name];
                    const isRequired = field.isRequired;
                    
                    return (
                      <div key={idx} className="space-y-2 col-span-2">
                        <label>{field.name} {isRequired ? "" : <span className="text-[10px] text-slate-400 font-normal ml-2">(Optional)</span>}</label>
                        
                        {field.type === "boolean" ? (
                          <label className="flex items-center gap-2 cursor-pointer bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 shadow-sm h-[42px] transition-all hover:bg-slate-100/30">
                            <input 
                              type="checkbox" 
                              className="accent-blue-600 rounded w-4 h-4 cursor-pointer"
                              checked={!!value}
                              onChange={e => setFormData({
                                ...formData,
                                metadata: { ...(formData.metadata || {}), [field.name]: e.target.checked }
                              })}
                            />
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Yes / Enabled</span>
                          </label>
                        ) : field.type === "datetime" ? (
                          <input 
                            type="datetime-local" 
                            required={isRequired}
                            className="input-field w-full py-2.5 bg-slate-50/50"
                            value={value || ""}
                            onChange={e => setFormData({
                              ...formData,
                              metadata: { ...(formData.metadata || {}), [field.name]: e.target.value }
                            })}
                          />
                        ) : field.type === "number" ? (
                          <input 
                            type="number" 
                            required={isRequired}
                            className="input-field w-full py-2.5 bg-slate-50/50"
                            placeholder={`Enter ${field.name}`}
                            value={value || ""}
                            onChange={e => setFormData({
                              ...formData,
                              metadata: { ...(formData.metadata || {}), [field.name]: parseFloat(e.target.value) || e.target.value }
                            })}
                          />
                        ) : field.type === "password" ? (
                          <input 
                            type="password" 
                            required={isRequired}
                            className="input-field w-full py-2.5 bg-slate-50/50 font-mono"
                            placeholder={`Enter ${field.name}`}
                            value={value || ""}
                            onChange={e => setFormData({
                              ...formData,
                              metadata: { ...(formData.metadata || {}), [field.name]: e.target.value }
                            })}
                          />
                        ) : (
                          <input 
                            type="text" 
                            required={isRequired}
                            className="input-field w-full py-2.5 bg-slate-50/50"
                            placeholder={`Enter ${field.name}`}
                            value={value || ""}
                            onChange={e => setFormData({
                              ...formData,
                              metadata: { ...(formData.metadata || {}), [field.name]: e.target.value }
                            })}
                          />
                        )}
                      </div>
                    );
                  })}

                  <div className="space-y-2 col-span-2">
                    <label>Description / Notes</label>
                    <textarea 
                      className="input-field w-full py-2.5 bg-slate-50/50 resize-none h-16"
                      placeholder="e.g. For accessing the main production DB"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>


                  <div className="space-y-2 col-span-2 relative">
                    <label>Smart Tagging</label>
                    <div className="relative group">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        className="input-field pl-12 w-full py-2.5 bg-slate-50/50"
                        placeholder="Search or add tags..."
                        value={tagInput}
                        onChange={e => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                        onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddTag(tagInput); } }}
                        onFocus={() => setShowTagSuggestions(true)}
                      />
                    </div>
                    
                    {/* Tag Suggestions Dropdown */}
                    <AnimatePresence>
                      {showTagSuggestions && filteredTags && filteredTags.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-48 overflow-y-auto p-2"
                        >
                          {filteredTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleAddTag(tag)}
                              className="w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-xl font-bold text-xs text-slate-600 flex items-center gap-2 transition-colors"
                            >
                              <Hash className="w-3.5 h-3.5 text-indigo-400" />
                              {tag}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {formData.tags.map(tag => (
                        <span 
                          key={tag}
                          className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold text-[10px] uppercase flex items-center gap-2 border border-indigo-100"
                        >
                          {tag}
                          <button onClick={() => setFormData({...formData, tags: formData.tags.filter(t => t !== tag)})} className="hover:bg-indigo-100 p-0.5 rounded-md transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                </div>

                <div className="p-8 pt-6 border-t border-slate-50 shrink-0 bg-white z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                  <button 
                    type="submit" 
                    disabled={addMutation.isPending || updateMutation.isPending}
                    className="btn-primary w-full flex items-center justify-center gap-3 shadow-2xl shadow-blue-600/20"
                  >
                    {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                    <span className="font-bold text-[11px] uppercase tracking-widest">{isEditMode ? "Save Changes" : "Commit to Secure Vault"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedCred && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md border border-white/20 flex flex-col max-h-[90vh]"
            >
              <div className="p-10 bg-slate-900 text-white relative shrink-0 rounded-t-[3rem]">
                <button 
                  onClick={() => {
                    setIsDetailOpen(false);
                    setShowPassInDetail(false);
                  }} 
                  className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-600/40">
                  <Key className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-2 break-all pr-10 leading-tight">{selectedCred.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCred.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">#{tag}</span>
                  ))}
                </div>
              </div>
              
              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-1 gap-6">
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Address</p>
                      {selectedCred.address ? (
                        <a href={selectedCred.address} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline break-all pr-4">
                          {selectedCred.address}
                        </a>
                      ) : (
                        <p className="text-sm font-bold text-slate-900">N/A</p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleCopy(selectedCred.address || "", 'address')}
                      className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm"
                    >
                      {copiedField === 'address' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  {selectedCred.description && (
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Description</p>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">{selectedCred.description}</p>
                    </div>
                  )}



                  {/* Dynamic Custom Fields Rendering */}
                  {selectedCred.metadata && Object.entries(selectedCred.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{key}</p>
                        <div className="text-sm font-bold text-slate-900 break-all pr-4">
                          {typeof value === 'boolean' ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${value ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                              {value ? 'YES' : 'NO'}
                            </span>
                          ) : (
                            String(value)
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCopy(String(value), key)}
                        className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm"
                      >
                        {copiedField === key ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  ))}

                  {selectedCred.username && (
                    <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Username / Identity</p>
                        <p className="text-sm font-bold text-slate-900 break-all pr-4">{selectedCred.username}</p>
                      </div>
                      <button 
                        onClick={() => handleCopy(selectedCred.username || "", 'username')}
                        className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm"
                      >
                        {copiedField === 'username' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  )}

                  {selectedCred.password && (
                    <div className="flex items-center justify-between p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Secure Secret / Password</p>
                        <SecurePasswordDisplay
                          itemId={selectedCred.id}
                          maskedPlaceholder={selectedCred.password}
                          revealedPassword={revealedPasswords[selectedCred.id]}
                          isVisible={showPassInDetail}
                          onToggleVisibility={() => setShowPassInDetail(!showPassInDetail)}
                          onRevealRequest={() => handleView(selectedCred)}
                          onCopySuccess={() => setCopiedField('password')}
                        />
                      </div>
                    </div>
                  )}

                </div>
                
                <div className="pt-4">
                  <button 
                    onClick={() => {
                      setIsDetailOpen(false);
                      setShowPassInDetail(false);
                    }}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-all"
                  >
                    Close Secure View
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Verification Modal */}
      <AnimatePresence>
        {isVerifyModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
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
                  {verifyPurpose === "EXPORT" 
                    ? "Enter your password to authorize vault export" 
                    : verifyPurpose === "EDIT"
                    ? "Enter your password to modify this security secret"
                    : "Enter your account password to reveal this secret"}
                </p>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!verifyPassword.trim()) return;
                  if (verifyPurpose === "REVEAL" && !pendingRevealCredId) return;

                  setIsVerifying(true);
                  setVerifyError("");
                  try {
                    if (verifyPurpose === "EXPORT") {
                      // Verify standard password check
                      await api.post("/auth/verify-password", { password: verifyPassword });
                      setIsVerifyModalOpen(false);
                      setVerifyPassword("");
                      setFailedVerifyAttempts(0);
                      handleExportToExcel();
                    } else if (verifyPurpose === "EDIT") {
                      // Verify standard password check for edit
                      await api.post("/auth/verify-password", { password: verifyPassword });
                      setIsVerifyModalOpen(false);
                      setVerifyPassword("");
                      setFailedVerifyAttempts(0);
                      if (pendingEditCred) {
                        handleEdit(pendingEditCred);
                        setPendingEditCred(null);
                      }
                    } else {
                      // Verify password then reveal secret
                      const res = await api.post(`/credentials/${pendingRevealCredId}/reveal`, { password: verifyPassword });
                      const credId = pendingRevealCredId as string;
                      setRevealedPasswords(prev => ({
                        ...prev,
                        [credId]: res.data.password || null
                      }));
                      setSelectedCred((prev: any) => prev ? { ...prev, ...res.data, password: res.data.password ?? prev.password } : res.data);
                      setShowPassInDetail(true);
                      setIsVerifyModalOpen(false);
                      setPendingRevealCredId(null);
                      setVerifyPassword("");
                      setFailedVerifyAttempts(0);
                      setIsDetailOpen(true);
                    }
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
                      onClick={() => { setIsVerifyModalOpen(false); setVerifyPassword(""); setVerifyError(""); setPendingEditCred(null); }}
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
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        {verifyPurpose === "EXPORT" ? "Verify & Export" : verifyPurpose === "EDIT" ? "Verify & Edit" : "Verify & Reveal"}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => credToDelete && deleteMutation.mutate(credToDelete)}
        title="Purge Credential?"
        message="This action is irreversible. The secret will be permanently removed from the secure vault and all access will be lost."
        confirmText="Yes, Purge Secret"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
