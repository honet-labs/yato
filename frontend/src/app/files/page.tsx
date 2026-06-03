"use client";
import { PageHeader } from "@/components/PageHeader";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import api from "@/lib/api";
import { 
  FolderOpen, 
  Search, 
  HardDrive, 
  Image, 
  FileText, 
  Archive, 
  File, 
  Download, 
  Trash2, 
  Settings, 
  TrendingUp, 
  Loader2, 
  Plus, 
  X, 
  Check, 
  Database,
  Cloud,
  ChevronDown,
  Info,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Format file size nicely
const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const DRIVER_STYLES: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  DATABASE: { label: "Database", color: "text-indigo-600 border-indigo-100", bg: "bg-indigo-50", icon: Database },
  NAS: { label: "NAS (Local)", color: "text-amber-600 border-amber-100", bg: "bg-amber-50", icon: HardDrive },
  S3: { label: "S3 Bucket", color: "text-blue-600 border-blue-100", bg: "bg-blue-50", icon: Cloud },
  GOOGLE_DRIVE: { label: "G-Drive", color: "text-emerald-600 border-emerald-100", bg: "bg-emerald-50", icon: ExternalLink },
};

export default function FileManagerPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"explorer" | "config" | "metrics">("explorer");
  const [activeCategory, setActiveCategory] = useState<"ALL" | "IMAGE" | "DOCUMENT" | "ARCHIVE" | "OTHER">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [driverFilter, setDriverFilter] = useState("ALL");
  const [selectedFile, setSelectedFile] = useState<any | null>(null);

  // Storage configuration state
  const [activeDriver, setActiveDriver] = useState("DATABASE");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Region, setS3Region] = useState("us-east-1");

  const [driveClientId, setDriveClientId] = useState("");
  const [driveClientSecret, setDriveClientSecret] = useState("");
  const [driveRefreshToken, setDriveRefreshToken] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");

  const [nasPath, setNasPath] = useState("./storage/nas");

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch all registered files
  const { data: files, isLoading: isLoadingFiles } = useQuery<any[]>({
    queryKey: ["storage-files"],
    queryFn: async () => {
      const res = await api.get("/storage/files");
      return res.data;
    }
  });

  // Fetch active configurations
  const { data: config, isLoading: isLoadingConfig } = useQuery<any>({
    queryKey: ["storage-config"],
    queryFn: async () => {
      const res = await api.get("/storage/config");
      return res.data;
    }
  });

  // Load configuration into local state when fetched
  useEffect(() => {
    if (config) {
      setActiveDriver(config.activeDriver || "DATABASE");
      setS3Endpoint(config.s3?.endpoint || "");
      setS3AccessKey(config.s3?.accessKeyId || "");
      setS3SecretKey(config.s3?.secretAccessKey || "");
      setS3Bucket(config.s3?.bucket || "");
      setS3Region(config.s3?.region || "us-east-1");

      setDriveClientId(config.googleDrive?.clientId || "");
      setDriveClientSecret(config.googleDrive?.clientSecret || "");
      setDriveRefreshToken(config.googleDrive?.refreshToken || "");
      setDriveFolderId(config.googleDrive?.folderId || "");

      setNasPath(config.nas?.path || "./storage/nas");
    }
  }, [config]);

  // Update configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/storage/config", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-config"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/storage/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-files"] });
      setSelectedFile(null);
    }
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate({
      activeDriver,
      s3: {
        endpoint: s3Endpoint,
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
        bucket: s3Bucket,
        region: s3Region
      },
      googleDrive: {
        clientId: driveClientId,
        clientSecret: driveClientSecret,
        refreshToken: driveRefreshToken,
        folderId: driveFolderId
      },
      nas: {
        path: nasPath
      }
    });
  };

  const handleDeleteFile = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus file '${name}' secara permanen dari server?`)) {
      deleteFileMutation.mutate(id);
    }
  };

  // Helper to categorize files
  const getFileCategory = (mime: string): "IMAGE" | "DOCUMENT" | "ARCHIVE" | "OTHER" => {
    const m = mime.toLowerCase();
    if (m.startsWith("image/")) return "IMAGE";
    if (m.startsWith("application/pdf") || m.includes("word") || m.includes("excel") || m.includes("sheet") || m.startsWith("text/")) return "DOCUMENT";
    if (m.includes("zip") || m.includes("tar") || m.includes("rar") || m.includes("gzip")) return "ARCHIVE";
    return "OTHER";
  };

  // Filter files based on category, driver, and search input
  const filteredFiles = files?.filter(file => {
    const category = getFileCategory(file.mimeType);
    const matchesCategory = activeCategory === "ALL" || category === activeCategory;
    const matchesDriver = driverFilter === "ALL" || file.driver === driverFilter;
    const matchesSearch = file.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (file.uploadedBy?.fullName && file.uploadedBy.fullName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesDriver && matchesSearch;
  }) || [];

  // Categorized counts
  const allCount = files?.length || 0;
  const imageCount = files?.filter(f => getFileCategory(f.mimeType) === "IMAGE").length || 0;
  const docCount = files?.filter(f => getFileCategory(f.mimeType) === "DOCUMENT").length || 0;
  const archiveCount = files?.filter(f => getFileCategory(f.mimeType) === "ARCHIVE").length || 0;
  const otherCount = files?.filter(f => getFileCategory(f.mimeType) === "OTHER").length || 0;

  // Calculate simulated usage metrics
  const totalBytesUsed = files?.reduce((acc, f) => acc + f.size, 0) || 0;
  const dbBytes = files?.filter(f => f.driver === "DATABASE").reduce((acc, f) => acc + f.size, 0) || 0;
  const nasBytes = files?.filter(f => f.driver === "NAS").reduce((acc, f) => acc + f.size, 0) || 0;
  const s3Bytes = files?.filter(f => f.driver === "S3").reduce((acc, f) => acc + f.size, 0) || 0;
  const gdriveBytes = files?.filter(f => f.driver === "GOOGLE_DRIVE").reduce((acc, f) => acc + f.size, 0) || 0;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <MobileNav />
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <main className="page-container p-8 flex-1">
          <div className="w-full">
          {/* Page Ribbon Header */}
          <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <PageHeader title="File Manager" subtitle="Centralized Attachment Registry & Storage Drivers" />
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200/40 flex items-center gap-0.5 self-start md:self-auto">
              <button 
                onClick={() => setActiveTab("explorer")}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 active:scale-95",
                  activeTab === "explorer" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <FolderOpen className="w-3.5 h-3.5" /> Explorer
              </button>
              <button 
                onClick={() => setActiveTab("config")}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 active:scale-95",
                  activeTab === "config" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Settings className="w-3.5 h-3.5" /> Storage Config
              </button>
              <button 
                onClick={() => setActiveTab("metrics")}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 active:scale-95",
                  activeTab === "metrics" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Usage Metrics
              </button>
            </div>
          </header>

          {/* Tab Content Explorer */}
          {activeTab === "explorer" && (
            <div className="space-y-6">
              {/* Explorer Toolbar Filters */}
              <section className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                  {/* Search input */}
                  <div className="relative group flex-1 max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="text"
                      placeholder="Cari file..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-field pl-10 w-full bg-white !py-2"
                    />
                  </div>

                  {/* Driver filter dropdown */}
                  <div className="relative">
                    <select
                      value={driverFilter}
                      onChange={(e) => setDriverFilter(e.target.value)}
                      className="input-field pr-10 w-44 appearance-none bg-white !py-2 cursor-pointer"
                    >
                      <option value="ALL">Semua Storage</option>
                      <option value="DATABASE">Database Only</option>
                      <option value="NAS">NAS Storage</option>
                      <option value="S3">S3 Bucket</option>
                      <option value="GOOGLE_DRIVE">Google Drive</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Display Current Active Driver Warning */}
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 font-bold text-[10px] uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" /> Active Driver: {config?.activeDriver || "DATABASE"}
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Folder Categories Sidebar */}
                <div className="lg:col-span-1 space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">Pustaka Kategori</span>
                  
                  {[
                    { id: "ALL", label: "Semua File", count: allCount, icon: FolderOpen },
                    { id: "IMAGE", label: "Gambar & Media", count: imageCount, icon: Image },
                    { id: "DOCUMENT", label: "Dokumen Kerja", count: docCount, icon: FileText },
                    { id: "ARCHIVE", label: "Berkas Arsip", count: archiveCount, icon: Archive },
                    { id: "OTHER", label: "File Lainnya", count: otherCount, icon: File },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id as any)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-between border transition-all duration-200",
                        activeCategory === cat.id 
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/10"
                          : "bg-white text-slate-600 border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <cat.icon className="w-4 h-4 shrink-0" />
                        <span>{cat.label}</span>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[9px] font-black",
                        activeCategory === cat.id ? "bg-blue-700/50 text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {cat.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* File Grid Explorer */}
                <div className="lg:col-span-3">
                  {isLoadingFiles ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-3 bg-white border border-slate-100 rounded-2xl">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Memuat database file...</span>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-3 bg-white border border-slate-100 rounded-2xl text-slate-400">
                      <FolderOpen className="w-10 h-10 text-slate-200" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tidak ada file yang ditemukan</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredFiles.map((file) => {
                        const category = getFileCategory(file.mimeType);
                        const driverObj = DRIVER_STYLES[file.driver] || { label: file.driver, color: "text-slate-600 border-slate-200", bg: "bg-slate-50", icon: File };
                        
                        return (
                          <motion.div
                            layoutId={file.id}
                            key={file.id}
                            onClick={() => setSelectedFile(file)}
                            className="bg-white border border-slate-100 hover:border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between gap-4 group"
                            whileHover={{ y: -2 }}
                          >
                            <div className="space-y-3">
                              {/* File Type Banner Display */}
                              <div className="h-24 w-full bg-slate-50 border border-slate-100/50 rounded-lg flex items-center justify-center relative overflow-hidden group-hover:bg-slate-100/50 transition-colors">
                                {category === "IMAGE" && file.driver === "DATABASE" ? (
                                  <img 
                                    src={file.path} 
                                    alt={file.filename}
                                    className="w-full h-full object-cover" 
                                  />
                                ) : category === "IMAGE" ? (
                                  // Proxy download URL to render image
                                  <img 
                                    src={`/api/storage/download/${file.id}`} 
                                    alt={file.filename}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // If failed to load remote proxy, display standard icon
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : null}

                                <div className="absolute inset-0 bg-transparent flex items-center justify-center p-2">
                                  {category === "IMAGE" ? null : (
                                    <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                      {category === "DOCUMENT" ? (
                                        <FileText className="w-5.5 h-5.5 text-blue-500" />
                                      ) : category === "ARCHIVE" ? (
                                        <Archive className="w-5.5 h-5.5 text-amber-500" />
                                      ) : (
                                        <File className="w-5.5 h-5.5 text-slate-400" />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Active Driver Tag Badge */}
                                <div className="absolute top-2 left-2">
                                  <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border flex items-center gap-1", driverObj.color, driverObj.bg)}>
                                    <driverObj.icon className="w-2.5 h-2.5" /> {driverObj.label}
                                  </span>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-[11px] font-bold text-slate-800 truncate mb-1" title={file.filename}>
                                  {file.filename}
                                </h4>
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                  <span>{formatSize(file.size)}</span>
                                  <span>{new Date(file.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                </div>
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="border-t border-slate-50 pt-3 flex items-center justify-between gap-2">
                              <span className="text-[9px] font-bold text-slate-400 truncate max-w-[100px]">
                                By {file.uploadedBy?.fullName || "System"}
                              </span>

                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <a
                                  href={`/api/storage/download/${file.id}`}
                                  download={file.filename}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 transition-all"
                                  title="Download File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  onClick={() => handleDeleteFile(file.id, file.filename)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                                  title="Delete File"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content Credentials Configuration */}
          {activeTab === "config" && (
            <div className="glass-card max-w-3xl mx-auto space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" /> Storage Engine Configurations
                </h2>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-1">
                  Atur media penyimpanan dinamis attachment tiket & request
                </p>
              </div>

              {isLoadingConfig ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fetching configuration data...</span>
                </div>
              ) : (
                <form onSubmit={handleSaveConfig} className="space-y-6">
                  {/* Select Active Storage Driver */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                      Active Storage Driver Provider
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { id: "DATABASE", label: "DATABASE (Base64)", desc: "Save directly in Postgres", icon: Database },
                        { id: "NAS", label: "NAS / Directory", desc: "Local server directory share", icon: HardDrive },
                        { id: "S3", label: "S3 Storage / MinIO", desc: "AWS S3 / MinIO Cloud Buckets", icon: Cloud },
                        { id: "GOOGLE_DRIVE", label: "Google Drive API", desc: "Google Drive OAuth 2.0 folder", icon: ExternalLink },
                      ].map((prov) => (
                        <button
                          key={prov.id}
                          type="button"
                          onClick={() => setActiveDriver(prov.id)}
                          className={cn(
                            "p-4 rounded-xl border flex flex-col items-center text-center gap-2.5 transition-all duration-200 hover:border-blue-300",
                            activeDriver === prov.id
                              ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                              : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50/50"
                          )}
                        >
                          <prov.icon className="w-6 h-6 shrink-0" />
                          <div>
                            <span className="text-[10.5px] font-extrabold uppercase block">{prov.label}</span>
                            <span className="text-[9px] font-semibold text-slate-400 block mt-0.5 leading-normal">{prov.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Driver Specific Input Credentials Panel */}
                  <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-xl space-y-4">
                    {activeDriver === "DATABASE" && (
                      <div className="space-y-2 text-slate-500 leading-relaxed text-[11.5px] font-medium flex items-start gap-2.5 p-2">
                        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>DATABASE Driver:</strong> File attachments will be serialized to Base64 Data URL format and saved directly in the PostgreSQL database table (`StorageFile.path`). Very practical for initial setup without external storage dependencies.
                        </div>
                      </div>
                    )}

                    {activeDriver === "NAS" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            NAS Local Mount Directory Path
                          </label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. ./storage/nas"
                            value={nasPath}
                            onChange={(e) => setNasPath(e.target.value)}
                            className="input-field w-full bg-white"
                          />
                          <p className="text-[9.5px] font-semibold text-slate-400 leading-normal">
                            Ensure the folder is writable by the container process user. The folder will be created automatically if it does not exist.
                          </p>
                        </div>
                      </div>
                    )}

                    {activeDriver === "S3" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              S3 API Endpoint Endpoint URL
                            </label>
                            <input 
                              type="url" 
                              required
                              placeholder="e.g. https://s3.amazonaws.com or http://minio:9000"
                              value={s3Endpoint}
                              onChange={(e) => setS3Endpoint(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              Bucket Name
                            </label>
                            <input 
                              type="text" 
                              required
                              placeholder="e.g. yato-attachments"
                              value={s3Bucket}
                              onChange={(e) => setS3Bucket(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              Access Key ID
                            </label>
                            <input 
                              type="text" 
                              required
                              placeholder="AKIAIOSFODNN7EXAMPLE"
                              value={s3AccessKey}
                              onChange={(e) => setS3AccessKey(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              Secret Access Key
                            </label>
                            <input 
                              type="password" 
                              required
                              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                              value={s3SecretKey}
                              onChange={(e) => setS3SecretKey(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              Region Code
                            </label>
                            <input 
                              type="text" 
                              required
                              placeholder="e.g. us-east-1"
                              value={s3Region}
                              onChange={(e) => setS3Region(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeDriver === "GOOGLE_DRIVE" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              OAuth 2.0 Client ID
                            </label>
                            <input 
                              type="text" 
                              required
                              placeholder="Client ID from Google Developer Console"
                              value={driveClientId}
                              onChange={(e) => setDriveClientId(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              OAuth 2.0 Client Secret
                            </label>
                            <input 
                              type="password" 
                              required
                              placeholder="Client Secret key"
                              value={driveClientSecret}
                              onChange={(e) => setDriveClientSecret(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              OAuth 2.0 Refresh Token
                            </label>
                            <input 
                              type="password" 
                              required
                              placeholder="Refresh token to renew access token"
                              value={driveRefreshToken}
                              onChange={(e) => setDriveRefreshToken(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                              Google Drive Folder ID (Optional)
                            </label>
                            <input 
                              type="text" 
                              placeholder="Target folder ID (leave empty for root)"
                              value={driveFolderId}
                              onChange={(e) => setDriveFolderId(e.target.value)}
                              className="input-field w-full bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form Footer Action */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 items-center">
                    <AnimatePresence>
                      {saveSuccess && (
                        <motion.span 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" /> Configuration saved successfully!
                        </motion.span>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={saveConfigMutation.isPending}
                      className="btn-primary"
                    >
                      {saveConfigMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...
                        </>
                      ) : (
                        "Save Configurations"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Tab Content Simulated Capacity & Metrics */}
          {activeTab === "metrics" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  title: "DATABASE CAPACITY", 
                  used: dbBytes, 
                  total: 10 * 1024 * 1024 * 1024, // 10GB mock limit
                  color: "bg-indigo-500", 
                  bg: "bg-indigo-50 border-indigo-100/50",
                  text: "text-indigo-600",
                  label: "PostgreSQL Blobs Storage",
                  icon: Database
                },
                { 
                  title: "NAS HARD DRIVE", 
                  used: nasBytes, 
                  total: 100 * 1024 * 1024 * 1024, // 100GB mock limit
                  color: "bg-amber-500", 
                  bg: "bg-amber-50 border-amber-100/50",
                  text: "text-amber-600",
                  label: "Local Shared Directories",
                  icon: HardDrive
                },
                { 
                  title: "S3 STORAGE SYSTEMS", 
                  used: s3Bytes, 
                  total: 500 * 1024 * 1024 * 1024, // 500GB mock limit
                  color: "bg-blue-500", 
                  bg: "bg-blue-50 border-blue-100/50",
                  text: "text-blue-600",
                  label: "Amazon Web Services / MinIO",
                  icon: Cloud
                },
                { 
                  title: "GOOGLE DRIVE SPACE", 
                  used: gdriveBytes, 
                  total: 15 * 1024 * 1024 * 1024, // 15GB standard free GDrive limit
                  color: "bg-emerald-500", 
                  bg: "bg-emerald-50 border-emerald-100/50",
                  text: "text-emerald-600",
                  label: "Google Apps cloud space",
                  icon: ExternalLink
                },
              ].map((m) => {
                const percent = Math.min(100, Math.max(0.1, (m.used / m.total) * 100));
                return (
                  <div key={m.title} className={cn("border rounded-2xl p-6 bg-white space-y-4 shadow-sm", m.bg)}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.title}</span>
                      <m.icon className={cn("w-5 h-5", m.text)} />
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-xl font-black text-slate-800 tracking-tight leading-none block">
                        {formatSize(m.used)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                        Used of {formatSize(m.total)}
                      </span>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-500", m.color)}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                        <span>{percent.toFixed(2)}% Space Used</span>
                        <span>{formatSize(m.total - m.used)} Available</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Central Stats block */}
              <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Platform Data Allocations</span>
                  <span className="text-2xl font-black text-slate-800 tracking-tight block">
                    {formatSize(totalBytesUsed)}
                  </span>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">
                    Terhitung dari seluruh berkas lampiran pendukung tiket, VM, dan media percakapan
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 shrink-0">
                  <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Files</span>
                    <span className="text-base font-black text-slate-800 block mt-0.5">{files?.length || 0}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Average Size</span>
                    <span className="text-base font-black text-slate-800 block mt-0.5">
                      {files && files.length > 0 ? formatSize(totalBytesUsed / files.length) : "0 Bytes"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==================== FILE PREVIEW MODAL POPUP ==================== */}
        <AnimatePresence>
          {selectedFile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl w-full max-w-2xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest truncate max-w-lg">
                    Pratinjau File: {selectedFile.filename}
                  </span>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all animate-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                  {/* Media Content Display */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-center max-h-[350px] overflow-hidden relative">
                    {getFileCategory(selectedFile.mimeType) === "IMAGE" ? (
                      <img 
                        src={selectedFile.driver === "DATABASE" ? selectedFile.path : `/api/storage/download/${selectedFile.id}`} 
                        alt={selectedFile.filename}
                        className="max-h-[300px] object-contain rounded-lg shadow-sm"
                      />
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                          {getFileCategory(selectedFile.mimeType) === "DOCUMENT" ? (
                            <FileText className="w-8 h-8 text-blue-500" />
                          ) : getFileCategory(selectedFile.mimeType) === "ARCHIVE" ? (
                            <Archive className="w-8 h-8 text-amber-500" />
                          ) : (
                            <File className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedFile.mimeType}</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata Specs Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50/50 border border-slate-100 rounded-xl p-5">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Filename</span>
                      <span className="text-[11px] font-bold text-slate-800 truncate block">{selectedFile.filename}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Storage Driver</span>
                      <span className="text-[11px] font-bold text-slate-800 block">
                        {DRIVER_STYLES[selectedFile.driver]?.label || selectedFile.driver} ({selectedFile.driver})
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase block">File Size</span>
                      <span className="text-[11px] font-bold text-slate-800 block">{formatSize(selectedFile.size)}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Uploaded Date</span>
                      <span className="text-[11px] font-bold text-slate-800 block">
                        {new Date(selectedFile.createdAt).toLocaleString('en-GB')}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Uploaded By</span>
                      <span className="text-[11px] font-bold text-slate-800 block">
                        {selectedFile.uploadedBy?.fullName || "System"} ({selectedFile.uploadedBy?.email || "N/A"})
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Linked Entity Category</span>
                      <span className="text-[11px] font-bold text-slate-800 block">
                        {selectedFile.entityType ? `${selectedFile.entityType} (ID: ${selectedFile.entityId})` : "Unlinked / Direct Upload"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                  <button 
                    onClick={() => handleDeleteFile(selectedFile.id, selectedFile.filename)}
                    className="btn-danger flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete File
                  </button>
                  
                  <a 
                    href={`/api/storage/download/${selectedFile.id}`}
                    download={selectedFile.filename}
                    className="btn-primary flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download File
                  </a>
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
