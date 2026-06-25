"use client";
import { PageHeader } from "@/components/PageHeader";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import api from "@/lib/api";
import { useBranding } from "@/context/branding-context";
import { 
  Settings, 
  Globe, 
  ShieldCheck, 
  Save, 
  Mail,
  Server,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ShieldAlert,
  Link2,
  List,
  Plus,
  Trash2,
  Zap,
  Monitor,
  MessageSquare,
  Send,
  Database,
  Bell,
  Clock,
  Activity,
  X,
  CheckSquare,
  LifeBuoy,
  Key,
  Cpu,
  Edit
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";


export default function SystemConfigPage() {
  const { refreshBranding } = useBranding();
  const { isAdmin, isLoading: isProfileLoading } = useIsAdmin();
  const [activeTab, setActiveTab] = useState("notifications" as "notifications" | "identity" | "database" | "catalogs" | "api-portal" | "tuning" | "hrm-security");
  const [isAddCatalogModalOpen, setIsAddCatalogModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle" as "idle" | "success" | "error");
  const [officeIpEnabled, setOfficeIpEnabled] = useState(false as boolean);
  const [officeIpWhitelist, setOfficeIpWhitelist] = useState("127.0.0.1, 192.168.201.18" as string);
  const [detectedIp, setDetectedIp] = useState("" as string);
  const [sessionTimeout, setSessionTimeout] = useState("15" as string);
  const [reminderConfig, setReminderConfig] = useState({
    taskMaxCount: 3,
    ticketMaxCount: 5,
    hrmMaxCount: 1
  });


  const [catalogs, setCatalogs] = useState([] as any[]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);

  const [brandingConfig, setBrandingConfig] = useState({
    appName: "YATO",
    appTitle: "YATO | Infrastructure Platform",
    appLogo: "",
    appFavicon: "",
    appFooter: "© 2026 YATO. All rights reserved."
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("Logo size must be under 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBrandingConfig(prev => ({ ...prev, appLogo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("Favicon size must be under 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBrandingConfig(prev => ({ ...prev, appFavicon: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };
  
  // Test statuses
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState(null as any);
  const [isTestingWa, setIsTestingWa] = useState(false);
  const [waTestStatus, setWaTestStatus] = useState(null as any);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestStatus, setTelegramTestStatus] = useState(null as any);

  const [emailConfig, setEmailConfig] = useState({
    host: "",
    port: "",
    user: "",
    pass: "",
    security: "STARTTLS",
    recipient: ""
  });

  const [whatsappConfig, setWhatsappConfig] = useState({
    url: "",
    apiKey: "",
    session: "default",
    recipient: ""
  });

  const [telegramConfig, setTelegramConfig] = useState({
    botToken: "",
    chatId: ""
  });

  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestStatus, setDbTestStatus] = useState(null as any);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [dbSaveStatus, setDbSaveStatus] = useState(null as any);

  const [dbConfig, setDbConfig] = useState({
    host: "localhost",
    port: "5432",
    user: "yato",
    password: "yatopass",
    database: "yato"
  });

  const [platformUrl, setPlatformUrl] = useState("https://yato.honet.web.id");
  const [autoProvisioning, setAutoProvisioning] = useState(true);

  const [timezoneConfig, setTimezoneConfig] = useState({
    mode: 'SERVER',
    manualValue: 'Asia/Jakarta'
  });
  const [serverTimezone, setServerTimezone] = useState("UTC");

  const [routingRules, setRoutingRules] = useState([] as any[]);
  const [roles, setRoles] = useState([] as any[]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState(null as number | null);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    categories: [],
    priorities: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
    ticketTypes: ["SUPPORT", "SERVICE", "VM"],
    targetRoles: []
  } as any);

  const [existingTags, setExistingTags] = useState([] as string[]);
  const [tagSearchInput, setTagSearchInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // API Token Portal States
  const [patDuration, setPatDuration] = useState(30 as number);
  const [patToken, setPatToken] = useState("" as string);
  const [patExpiresAt, setPatExpiresAt] = useState("" as string);
  const [isGeneratingPat, setIsGeneratingPat] = useState(false as boolean);
  const [selectedSnippet, setSelectedSnippet] = useState("curl" as "curl" | "js" | "python" | "n8n");

  // Tuning & Optimization States
  const [tuningConfig, setTuningConfig] = useState({
    ramLimit: "1024",
    dbPoolLimit: "20",
    notificationConcurrency: "5",
    cacheTtlSeconds: "600"
  });
  const [isSavingTuning, setIsSavingTuning] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartCountdown, setRestartCountdown] = useState(15);
  const [restartMessage, setRestartMessage] = useState("");

  const fetchTuningConfig = async () => {
    try {
      const response = await api.get("/system/config/tuning");
      setTuningConfig(response.data);
    } catch (e) {
      console.error("Failed to load tuning configs", e);
    }
  };

  const handleSaveTuning = async (e: React.FormEvent, withRestart: boolean = true) => {
    e.preventDefault();
    setIsSavingTuning(true);
    try {
      const response = await api.post("/system/config/tuning", {
        ...tuningConfig,
        triggerRestart: withRestart
      });
      
      if (withRestart) {
        startRestartCountdown("Tuning configuration saved successfully! System is applying changes and restarting...");
      } else {
        alert(response.data.message || "Tuning configurations saved successfully. Restart required to apply some changes.");
      }
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to save tuning configurations.");
    } finally {
      setIsSavingTuning(false);
    }
  };

  const handleManualRestart = async () => {
    if (!confirm("Are you sure you want to restart YATO system services? This will temporarily interrupt ongoing connections.")) return;
    try {
      await api.post("/system/config/restart");
      startRestartCountdown("Manual system restart initiated. Reloading all services...");
    } catch (e: any) {
      alert("Failed to initiate manual restart.");
    }
  };

  const startRestartCountdown = (message: string) => {
    setIsRestarting(true);
    setRestartCountdown(15);
    setRestartMessage(message);
    
    const interval = setInterval(() => {
      setRestartCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          startPingLoop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startPingLoop = () => {
    setRestartMessage("Pinging YATO gateway server...");
    const pingInterval = setInterval(async () => {
      try {
        await api.get("/system/config/branding");
        clearInterval(pingInterval);
        setRestartMessage("System successfully reconnected! Reloading page...");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (e) {
        // Continue pinging
      }
    }, 2000);
  };

  const handleGeneratePat = async () => {
    setIsGeneratingPat(true);
    try {
      const response = await api.post("/auth/token", { duration: patDuration });
      setPatToken(response.data.token);
      setPatExpiresAt(response.data.expiresAt);
    } catch (e) {
      alert("Failed to generate token. Please try again.");
    } finally {
      setIsGeneratingPat(false);
    }
  };
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(patToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const fetchSettings = async () => {
    try {
      const response = await api.get("/system/config");
      const settings = response.data;
      if (settings.EMAIL_CONFIG) setEmailConfig(settings.EMAIL_CONFIG);
      if (settings.WHATSAPP_CONFIG) setWhatsappConfig(settings.WHATSAPP_CONFIG);
      if (settings.TELEGRAM_CONFIG) setTelegramConfig(settings.TELEGRAM_CONFIG);
      if (settings.PLATFORM_URL) setPlatformUrl(settings.PLATFORM_URL);
      if (settings.REMINDER_CONFIG) {
        setReminderConfig({
          taskMaxCount: settings.REMINDER_CONFIG.taskMaxCount ?? 3,
          ticketMaxCount: settings.REMINDER_CONFIG.ticketMaxCount ?? 5,
          hrmMaxCount: settings.REMINDER_CONFIG.hrmMaxCount ?? 1
        });
      }
      if (settings.DB_CONFIG) setDbConfig(settings.DB_CONFIG);
      if (settings.AUTOMATED_PROVISIONING_ENABLED) {
        setAutoProvisioning(
          typeof settings.AUTOMATED_PROVISIONING_ENABLED === 'object' && settings.AUTOMATED_PROVISIONING_ENABLED !== null
            ? !!settings.AUTOMATED_PROVISIONING_ENABLED.enabled
            : settings.AUTOMATED_PROVISIONING_ENABLED === 'true' || settings.AUTOMATED_PROVISIONING_ENABLED === true
        );
      }
      if (settings.TIMEZONE_CONFIG) setTimezoneConfig(settings.TIMEZONE_CONFIG);
      if (settings.SERVER_TIMEZONE) setServerTimezone(settings.SERVER_TIMEZONE);
      if (settings.office_ip_enabled !== undefined) {
        setOfficeIpEnabled(settings.office_ip_enabled === "true" || settings.office_ip_enabled === true);
      }
      if (settings.office_ip_whitelist !== undefined) {
        setOfficeIpWhitelist(settings.office_ip_whitelist);
      }
      if (settings.SESSION_TIMEOUT !== undefined) {
        setSessionTimeout(String(settings.SESSION_TIMEOUT));
      }
      if (settings.BRANDING_CONFIG) {
        setBrandingConfig(prev => ({
          ...prev,
          ...settings.BRANDING_CONFIG
        }));
      }
      if (settings.NOTIFICATION_ROUTING_RULES) {
        setRoutingRules(settings.NOTIFICATION_ROUTING_RULES);
      }
      // Fetch system roles list
      const rolesRes = await api.get("/roles");
      setRoles(rolesRes.data);
      
      // Fetch unique support ticket tags
      try {
        const tagsRes = await api.get("/support-tickets/tags");
        setExistingTags(tagsRes.data);
      } catch (err) {
        console.error("Failed to load unique tags", err);
      }
    } catch (e: any) { console.error(e); }
  };

  const [newCatalog, setNewCatalog] = useState({
    category: "SERVICE_TYPE",
    name: "",
    value: "",
    metadata: { customFields: [] }
  } as any);
  const [editingCatalogId, setEditingCatalogId] = useState(null as string | null);

  const handleOpenAddCatalog = () => {
    setNewCatalog({
      category: "SERVICE_TYPE",
      name: "",
      value: "",
      description: "",
      metadata: { customFields: [] }
    });
    setEditingCatalogId(null);
    setIsAddCatalogModalOpen(true);
  };

  const handleOpenEditCatalog = (item: any) => {
    setNewCatalog({
      category: item.category,
      name: item.name,
      value: item.value,
      description: item.description || "",
      metadata: item.metadata || { customFields: [] }
    });
    setEditingCatalogId(item.id);
    setIsAddCatalogModalOpen(true);
  };

  const fetchCatalogs = async () => {
    try {
      const response = await api.get("/catalog");
      setCatalogs(response.data);
    } catch (e: any) { console.error(e); }
    finally { setIsLoadingCatalogs(false); }
  };

  useEffect(() => {
    fetchCatalogs();
    fetchSettings();
    fetchTuningConfig();
  }, []);

  useEffect(() => {
    if (activeTab === "hrm-security") {
      fetch("https://api.ipify.org?format=json")
        .then(res => res.json())
        .then(data => setDetectedIp(data.ip))
        .catch(err => console.error("Failed to detect client public IP:", err));
    }
  }, [activeTab]);


  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      await api.put("/system/config", {
        EMAIL_CONFIG: emailConfig,
        WHATSAPP_CONFIG: whatsappConfig,
        TELEGRAM_CONFIG: telegramConfig,
        PLATFORM_URL: platformUrl,
        REMINDER_CONFIG: reminderConfig,
        AUTOMATED_PROVISIONING_ENABLED: { enabled: autoProvisioning },
        TIMEZONE_CONFIG: timezoneConfig,
        BRANDING_CONFIG: brandingConfig,
        NOTIFICATION_ROUTING_RULES: routingRules,
        office_ip_enabled: officeIpEnabled ? "true" : "false",
        office_ip_whitelist: officeIpWhitelist,
        SESSION_TIMEOUT: sessionTimeout
      });
      setSaveStatus("success");
      // Instantly apply branding across sidebar, header, browser title, and favicon!
      await refreshBranding();
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e: any) {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };


  const handleAddCatalog = async () => {
    if (!newCatalog.name || !newCatalog.value) return;
    try {
      if (editingCatalogId) {
        await api.put(`/catalog/${editingCatalogId}`, newCatalog);
      } else {
        await api.post("/catalog", newCatalog);
      }
      setNewCatalog({ category: "SERVICE_TYPE", name: "", value: "", description: "", metadata: { customFields: [] } });
      setEditingCatalogId(null);
      setIsAddCatalogModalOpen(false);
      fetchCatalogs();
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.message || e.message || "Failed to save catalog item. Please try again.");
    }
  };

  const handleAddCustomField = () => {
    const fields = newCatalog.metadata?.customFields || [];
    setNewCatalog({
      ...newCatalog,
      metadata: { customFields: [...fields, { name: "", type: "text", isRequired: false }] }
    });
  };

  const handleRemoveCustomField = (index: number) => {
    const fields = [...(newCatalog.metadata?.customFields || [])];
    fields.splice(index, 1);
    setNewCatalog({ ...newCatalog, metadata: { customFields: fields } });
  };

  const handleUpdateCustomField = (index: number, key: string, value: any) => {
    const fields = [...(newCatalog.metadata?.customFields || [])];
    fields[index] = { ...fields[index], [key]: value };
    setNewCatalog({ ...newCatalog, metadata: { customFields: fields } });
  };

  const handleRemoveCatalog = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/catalog/${id}`);
      fetchCatalogs();
    } catch (e: any) { console.error(e); }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setEmailTestStatus(null);
    try {
      const response = await api.post("/notifications/test-email", emailConfig);
      setEmailTestStatus(response.data);
    } catch (e: any) {
      setEmailTestStatus({ success: false, message: "Network error or server timeout" });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleTestWa = async () => {
    setIsTestingWa(true);
    setWaTestStatus(null);
    try {
      const response = await api.post("/notifications/test-wa", whatsappConfig);
      setWaTestStatus(response.data);
    } catch (e: any) {
      setWaTestStatus({ success: false, message: "Network error" });
    } finally {
      setIsTestingWa(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramTestStatus(null);
    try {
      const response = await api.post("/notifications/test-telegram", telegramConfig);
      setTelegramTestStatus(response.data);
    } catch (e: any) {
      setTelegramTestStatus({ success: false, message: "Network error" });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTestDb = async () => {
    setIsTestingDb(true);
    setDbTestStatus(null);
    try {
      const response = await api.post("/system/config/db/test", dbConfig);
      setDbTestStatus(response.data);
    } catch (e: any) {
      setDbTestStatus({ success: false, message: e.response?.data?.message || "Network error" });
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleSaveDb = async () => {
    if (!confirm("Saving database configuration will modify the environment file. A backend restart will be required. Proceed?")) return;
    setIsSavingDb(true);
    setDbSaveStatus(null);
    try {
      const response = await api.post("/system/config/db/save", dbConfig);
      setDbSaveStatus(response.data);
    } catch (e: any) {
      setDbSaveStatus({ success: false, message: e.response?.data?.message || "Failed to save configuration" });
    } finally {
      setIsSavingDb(false);
    }
  };

  if (isProfileLoading || isLoadingCatalogs) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Configuration Parameters...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 bg-rose-50 rounded-full border border-rose-200 flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-400">You must hold administrative privileges to access System Parameters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background font-sans text-[13px]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileNav />
        
        <main className="page-container overflow-y-auto custom-scrollbar">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <PageHeader title="System Parameters" subtitle="Global platform orchestration and alert delivery" />
          </div>
          <button 
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="btn-primary flex items-center justify-center gap-2.5 px-8 py-3 shadow-xl shadow-blue-600/20 disabled:opacity-50 w-full md:w-auto shrink-0"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              saveStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> : 
              saveStatus === 'error' ? <AlertCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />
            )}
            <span className="font-bold uppercase tracking-widest text-[11px]">
              {isSaving ? "Saving..." : saveStatus === 'success' ? "Changes Saved" : saveStatus === 'error' ? "Save Failed" : "Commit Changes"}
            </span>
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mb-8 bg-white/50 p-1.5 rounded-2xl border border-slate-200/60 shadow-sm w-fit backdrop-blur-sm">
          <button 
            onClick={() => setActiveTab('notifications')}
            className={cn("px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'notifications' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-white")}
          >
            <Bell className="w-4 h-4" />
            Notifications
          </button>
          <button 
            onClick={() => setActiveTab('identity')}
            className={cn("px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'identity' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-white")}
          >
            <Globe className="w-4 h-4" />
            Platform Identity
          </button>
          <button 
            onClick={() => setActiveTab('database')}
            className={cn("px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'database' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-white")}
          >
            <Database className="w-4 h-4" />
            Primary Database
          </button>
          <button 
            onClick={() => setActiveTab('catalogs')}
            className={cn("px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'catalogs' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-white")}
          >
            <List className="w-4 h-4" />
            Resource Catalogs
          </button>
          <button 
            onClick={() => setActiveTab('api-portal')}
            className={cn("px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'api-portal' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-white")}
          >
            <Key className="w-4 h-4" />
            API Access & Devs
          </button>
          <button 
            onClick={() => setActiveTab('tuning')}
            className={cn("px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'tuning' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-white")}
          >
            <Cpu className="w-4 h-4" />
            Performance & Tuning
          </button>
          <button 
            onClick={() => setActiveTab('hrm-security')}
            className={cn("px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'hrm-security' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-white")}
          >
            <ShieldCheck className="w-4 h-4" />
            HRM & Security Whitelisting
          </button>
        </div>

        {activeTab === 'notifications' && (
          <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Email Settings */}
          <form onSubmit={e => e.preventDefault()} className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
            <div className="flex items-center gap-3 mb-8">
              <Mail className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Email Delivery Subsystem</h2>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-1.5">
                  <label>SMTP Relay Host</label>
                  <input 
                    type="text" 
                    className="input-field w-full" 
                    value={emailConfig.host} 
                    onChange={e => setEmailConfig({...emailConfig, host: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Port</label>
                  <input 
                    type="text" 
                    className="input-field w-full text-center" 
                    value={emailConfig.port}
                    onChange={e => setEmailConfig({...emailConfig, port: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label>Relay Username</label>
                  <input 
                    type="text" 
                    className="input-field w-full" 
                    value={emailConfig.user}
                    onChange={e => setEmailConfig({...emailConfig, user: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Relay Password</label>
                  <input 
                    type="password" 
                    autoComplete="new-password"
                    className="input-field w-full" 
                    value={emailConfig.pass}
                    onChange={e => setEmailConfig({...emailConfig, pass: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 items-end">
                <div className="col-span-2 space-y-1.5">
                  <label>Security Protocol</label>
                  <select 
                    className="input-field w-full bg-white"
                    value={emailConfig.security}
                    onChange={e => setEmailConfig({...emailConfig, security: e.target.value})}
                  >
                    <option value="NONE">None (Insecure)</option>
                    <option value="STARTTLS">STARTTLS (587)</option>
                    <option value="SSL">SSL / TLS (465)</option>
                  </select>
                </div>
                <button 
                  onClick={handleTestEmail}
                  disabled={isTestingEmail}
                  className="btn-secondary py-3 flex items-center justify-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  {isTestingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Test SMTP
                </button>
              </div>

              <AnimatePresence>
                {emailTestStatus && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={cn(
                      "p-3 rounded-xl border flex items-center gap-3 text-[11px] font-bold",
                      emailTestStatus.success ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
                    )}
                  >
                    {emailTestStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {emailTestStatus.message}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5 pt-4 border-t border-slate-50">
                <label>Admin Email Recipients</label>
                <input 
                  type="text" 
                  className="input-field w-full" 
                  value={emailConfig.recipient}
                  onChange={e => setEmailConfig({...emailConfig, recipient: e.target.value})}
                />
              </div>
            </div>
          </form>

          {/* WhatsApp Settings */}
          <form onSubmit={e => e.preventDefault()} className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
            <div className="flex items-center gap-3 mb-8">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">WhatsApp Notification (WAHA)</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label>WAHA Gateway URL</label>
                <input 
                  type="text" 
                  className="input-field w-full" 
                  placeholder="http://localhost:3000"
                  value={whatsappConfig.url} 
                  onChange={e => setWhatsappConfig({...whatsappConfig, url: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label>API Key</label>
                <input 
                  type="password" 
                  autoComplete="new-password"
                  className="input-field w-full" 
                  placeholder="Your WAHA API Key"
                  value={whatsappConfig.apiKey} 
                  onChange={e => setWhatsappConfig({...whatsappConfig, apiKey: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label>Session Name</label>
                  <input 
                    type="text" 
                    className="input-field w-full" 
                    value={whatsappConfig.session} 
                    onChange={e => setWhatsappConfig({...whatsappConfig, session: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Test Recipient Number</label>
                  <input 
                    type="text" 
                    className="input-field w-full" 
                    placeholder="62812345678"
                    value={whatsappConfig.recipient} 
                    onChange={e => setWhatsappConfig({...whatsappConfig, recipient: e.target.value})}
                  />
                </div>
              </div>
              <button 
                onClick={handleTestWa}
                disabled={isTestingWa}
                className="btn-secondary w-full py-3 flex items-center justify-center gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              >
                {isTestingWa ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Test WhatsApp
              </button>

              <AnimatePresence>
                {waTestStatus && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={cn(
                      "p-3 rounded-xl border flex items-center gap-3 text-[11px] font-bold",
                      waTestStatus.success ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
                    )}
                  >
                    {waTestStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {waTestStatus.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>

          {/* Telegram Settings */}
          <form onSubmit={e => e.preventDefault()} className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
            <div className="flex items-center gap-3 mb-8">
              <Send className="w-5 h-5 text-blue-500" />
              <h2 className="text-sm font-bold text-slate-900">Telegram Notification Bot</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label>Bot API Token</label>
                <input 
                  type="password" 
                  autoComplete="new-password"
                  className="input-field w-full" 
                  placeholder="123456:ABC-DEF..."
                  value={telegramConfig.botToken} 
                  onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label>Admin Chat ID</label>
                <input 
                  type="text" 
                  className="input-field w-full" 
                  placeholder="-100123456789 or 12345678"
                  value={telegramConfig.chatId} 
                  onChange={e => setTelegramConfig({...telegramConfig, chatId: e.target.value})}
                />
                <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
                  Enter your Personal ID or Group ID. Tip: Message <code className="text-blue-500 font-bold">@GetMyIDBot</code> to find your ID. <br/>
                  <span className="text-rose-500 font-bold">Warning:</span> Do not use the Bot's own ID as the recipient.
                </p>
              </div>
              <button 
                onClick={handleTestTelegram}
                disabled={isTestingTelegram}
                className="btn-secondary w-full py-3 flex items-center justify-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                {isTestingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Test Telegram
              </button>

              <AnimatePresence>
                {telegramTestStatus && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-2xl border flex items-start gap-3 text-[11px] font-semibold leading-relaxed shadow-sm",
                      telegramTestStatus.success 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                        : "bg-rose-50 border-rose-100 text-rose-700"
                    )}
                  >
                    {telegramTestStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                    )}
                    <div className="flex-1">
                      <p className="font-bold uppercase text-[9px] mb-0.5 tracking-wider">
                        {telegramTestStatus.success ? "Connection Established" : "Delivery Failed"}
                      </p>
                      {telegramTestStatus.message}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>

        {/* Notification Routing Rules Manager */}
        <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Notification Routing Rules</h2>
                <p className="text-[10px] text-slate-400 font-medium">Route support and request tickets to specific roles based on categories and priorities.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingRuleIndex(null);
                setRuleForm({
                  name: "",
                  categories: [],
                  priorities: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
                  ticketTypes: ["SUPPORT", "SERVICE", "VM"],
                  targetRoles: []
                });
                setIsRuleModalOpen(true);
              }}
              className="btn-primary py-2.5 px-4 text-xs flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all self-start md:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Rule
            </button>
          </div>

          {/* Rules Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rule Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ticket Types</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Tags/Categories</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priorities</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Roles</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {routingRules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldAlert className="w-8 h-8 text-slate-300 animate-bounce" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">No Routing Rules Configured</p>
                        <p className="text-[10px] text-slate-400">Default fallback: all tickets are routed to ADMIN and TICKETING_ADMIN.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  routingRules.map((rule, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-900">{rule.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {rule.ticketTypes?.map((t: string) => (
                            <span key={t} className="badge bg-slate-100 text-slate-600 border-slate-200 text-[9px] font-bold uppercase tracking-wide">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {rule.categories && rule.categories.length > 0 ? (
                            rule.categories.map((c: string) => (
                              <span key={c} className="badge bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] font-bold uppercase tracking-wide">
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">ANY CATEGORY</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {rule.priorities?.map((p: string) => {
                            const colors: Record<string, string> = {
                              LOW: "bg-slate-100 text-slate-600 border-slate-200",
                              NORMAL: "bg-blue-50 text-blue-600 border-blue-100",
                              HIGH: "bg-orange-50 text-orange-600 border-orange-100",
                              URGENT: "bg-rose-50 text-rose-600 border-rose-100",
                              CRITICAL: "bg-red-50 text-red-600 border-red-100",
                            };
                            return (
                              <span key={p} className={cn("badge text-[8px] font-bold uppercase tracking-tighter", colors[p] || "bg-slate-100 text-slate-600")}>
                                {p}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {rule.targetRoles?.map((r: string) => (
                            <span key={r} className="badge bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold uppercase tracking-wide">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRuleIndex(idx);
                              setRuleForm({
                                name: rule.name,
                                categories: rule.categories || [],
                                priorities: rule.priorities || [],
                                ticketTypes: rule.ticketTypes || [],
                                targetRoles: rule.targetRoles || []
                              });
                              setIsRuleModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Rule"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newRules = [...routingRules];
                              newRules.splice(idx, 1);
                              setRoutingRules(newRules);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Routing Rule Add/Edit Modal */}
        <AnimatePresence>
          {isRuleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {editingRuleIndex !== null ? "Edit Routing Rule" : "Create Routing Rule"}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Define a new target path for ticket notifications.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRuleModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rule Name</label>
                    <input
                      type="text"
                      className="input-field w-full"
                      placeholder="e.g. Network Team High Priority Route"
                      value={ruleForm.name}
                      onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                    />
                  </div>

                  {/* Ticket Types */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ticket Types</label>
                    <div className="flex gap-3">
                      {["SUPPORT", "SERVICE", "VM"].map((type) => {
                        const isChecked = ruleForm.ticketTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setRuleForm({ ...ruleForm, ticketTypes: ruleForm.ticketTypes.filter((t: string) => t !== type) });
                              } else {
                                setRuleForm({ ...ruleForm, ticketTypes: [...ruleForm.ticketTypes, type] });
                              }
                            }}
                            className={cn(
                              "px-3 py-2 rounded-xl text-xs font-bold border transition-all flex-1",
                              isChecked
                                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Tags/Categories</label>
                    
                    {/* Selected tags */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {ruleForm.categories && ruleForm.categories.length > 0 ? (
                        ruleForm.categories.map((c: string) => (
                          <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[9px] font-bold uppercase tracking-wide">
                            {c}
                            <button 
                              type="button" 
                              onClick={() => {
                                setRuleForm({ ...ruleForm, categories: ruleForm.categories.filter((cat: string) => cat !== c) });
                              }}
                              className="hover:text-indigo-800"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No tags selected (Matches ANY tag)</span>
                      )}
                    </div>

                    {/* Autocomplete Input */}
                    <div className="relative">
                      <input
                        type="text"
                        className="input-field w-full text-xs font-semibold"
                        placeholder="Type or search tags to route... (press Enter to add)"
                        value={tagSearchInput}
                        onChange={e => {
                          setTagSearchInput(e.target.value);
                          setShowTagSuggestions(true);
                        }}
                        onFocus={() => setShowTagSuggestions(true)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = tagSearchInput.trim().toUpperCase();
                            if (val) {
                              if (!ruleForm.categories.includes(val)) {
                                setRuleForm({ ...ruleForm, categories: [...ruleForm.categories, val] });
                              }
                              setTagSearchInput("");
                              setShowTagSuggestions(false);
                            }
                          }
                        }}
                      />

                      {showTagSuggestions && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowTagSuggestions(false)} />
                          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 max-h-[160px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                            {(() => {
                              const filtered = existingTags.filter(t => 
                                t.toLowerCase().includes(tagSearchInput.toLowerCase()) && 
                                !ruleForm.categories.includes(t.toUpperCase())
                              );
                              if (filtered.length === 0) {
                                if (tagSearchInput.trim()) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const val = tagSearchInput.trim().toUpperCase();
                                        if (!ruleForm.categories.includes(val)) {
                                          setRuleForm({ ...ruleForm, categories: [...ruleForm.categories, val] });
                                        }
                                        setTagSearchInput("");
                                        setShowTagSuggestions(false);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-indigo-600 font-bold hover:bg-slate-50 rounded-xl flex items-center justify-between"
                                    >
                                      <span>Create tag "{tagSearchInput.toUpperCase()}"</span>
                                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-100 uppercase font-black tracking-widest">New</span>
                                    </button>
                                  );
                                }
                                return (
                                  <p className="text-[10px] text-slate-400 text-center py-3 font-bold uppercase tracking-widest">No existing tags</p>
                                );
                              }
                              return filtered.map(tag => (
                                <button
                                  type="button"
                                  key={tag}
                                  onClick={() => {
                                    const val = tag.toUpperCase();
                                    if (!ruleForm.categories.includes(val)) {
                                      setRuleForm({ ...ruleForm, categories: [...ruleForm.categories, val] });
                                    }
                                    setTagSearchInput("");
                                    setShowTagSuggestions(false);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 font-semibold hover:bg-slate-50 rounded-xl transition-all flex items-center justify-between"
                                >
                                  <span>{tag}</span>
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200/50 uppercase font-bold">Existing</span>
                                </button>
                              ));
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">Rule matches if the ticket category or tags contain any of these selected tags.</p>
                  </div>

                  {/* Priorities */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-bold font-bold">Priorities</label>
                    <div className="flex flex-wrap gap-2">
                      {["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"].map((p) => {
                        const isChecked = ruleForm.priorities.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setRuleForm({ ...ruleForm, priorities: ruleForm.priorities.filter((item: string) => item !== p) });
                              } else {
                                setRuleForm({ ...ruleForm, priorities: [...ruleForm.priorities, p] });
                              }
                            }}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                              isChecked
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Target Roles */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-bold">Target Recipient Roles</label>
                    <div className="grid grid-cols-2 gap-3 max-h-[150px] overflow-y-auto p-1 custom-scrollbar">
                      {roles.map((role: any) => {
                        const isChecked = ruleForm.targetRoles.includes(role.name);
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setRuleForm({ ...ruleForm, targetRoles: ruleForm.targetRoles.filter((r: string) => r !== role.name) });
                              } else {
                                setRuleForm({ ...ruleForm, targetRoles: [...ruleForm.targetRoles, role.name] });
                              }
                            }}
                            className={cn(
                              "p-3 rounded-xl border text-left transition-all",
                              isChecked
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-100"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <p className="text-xs font-bold uppercase">{role.name}</p>
                            <p className="text-[9px] text-slate-400 truncate max-w-[180px]">{role.description || "No description"}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsRuleModalOpen(false)}
                    className="btn-secondary px-4 py-2.5 text-xs font-bold rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!ruleForm.name) {
                        alert("Rule Name is required.");
                        return;
                      }
                      if (ruleForm.targetRoles.length === 0) {
                        alert("Please select at least one Target Role.");
                        return;
                      }

                      const preparedRule = {
                        name: ruleForm.name,
                        categories: ruleForm.categories || [],
                        priorities: ruleForm.priorities,
                        ticketTypes: ruleForm.ticketTypes,
                        targetRoles: ruleForm.targetRoles
                      };

                      const updatedRules = [...routingRules];
                      if (editingRuleIndex !== null) {
                        updatedRules[editingRuleIndex] = preparedRule;
                      } else {
                        updatedRules.push(preparedRule);
                      }

                      setRoutingRules(updatedRules);
                      setIsRuleModalOpen(false);
                    }}
                    className="btn-primary px-4 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                  >
                    Apply Change
                  </button>
                </div>
              </motion.div>
            </div>
           )}
         </AnimatePresence>
        {/* Granular Reminder Settings */}
        <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 mt-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Granular Reminder Settings</h2>
              <p className="text-[10px] text-slate-400 font-medium">Configure maximum notification reminder attempts per module to prevent user spam.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-bold">Task Tracker Reminders Limit</label>
              <input 
                type="number" 
                min="1"
                max="50"
                className="input-field w-full font-semibold text-slate-800" 
                value={reminderConfig.taskMaxCount}
                onChange={e => setReminderConfig({...reminderConfig, taskMaxCount: parseInt(e.target.value) || 1})}
              />
              <p className="text-[9px] text-slate-400">Maximum daily/bootstrap reminder alerts sent to assignees for a single task.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-bold">Support Ticket Update Limit</label>
              <input 
                type="number" 
                min="1"
                max="50"
                className="input-field w-full font-semibold text-slate-800" 
                value={reminderConfig.ticketMaxCount}
                onChange={e => setReminderConfig({...reminderConfig, ticketMaxCount: parseInt(e.target.value) || 1})}
              />
              <p className="text-[9px] text-slate-400">Maximum notification activities sent to followers/owners per ticket.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-bold">HRM Attendance Reminders Limit</label>
              <input 
                type="number" 
                min="1"
                max="50"
                className="input-field w-full font-semibold text-slate-800" 
                value={reminderConfig.hrmMaxCount}
                onChange={e => setReminderConfig({...reminderConfig, hrmMaxCount: parseInt(e.target.value) || 1})}
              />
              <p className="text-[9px] text-slate-400">Maximum daily clock-in/clock-out reminders sent to an employee.</p>
            </div>
          </div>
        </section>
          </>
        )}

        {activeTab === 'identity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Platform Identity */}
          <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
            <div className="flex items-center gap-3 mb-8">
              <Globe className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Platform Identity & Branding</h2>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label>Application Name</label>
                  <input 
                    type="text" 
                    className="input-field w-full font-semibold text-slate-800" 
                    value={brandingConfig.appName}
                    onChange={e => setBrandingConfig({...brandingConfig, appName: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Browser Page Title</label>
                  <input 
                    type="text" 
                    className="input-field w-full font-semibold text-slate-800" 
                    value={brandingConfig.appTitle}
                    onChange={e => setBrandingConfig({...brandingConfig, appTitle: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label>Platform Footer Text</label>
                <input 
                  type="text" 
                  className="input-field w-full font-semibold text-slate-800" 
                  value={brandingConfig.appFooter || ""}
                  onChange={e => setBrandingConfig({...brandingConfig, appFooter: e.target.value})}
                  placeholder="© 2026 YATO. All rights reserved."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="space-y-1.5">
                  <label>Upload Application Logo</label>
                  <div className="flex items-center gap-3">
                    {brandingConfig.appLogo ? (
                      <img src={brandingConfig.appLogo} alt="Logo Preview" className="w-10 h-10 object-contain rounded-lg border border-slate-200 p-1" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                        No Logo
                      </div>
                    )}
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload}
                        className="hidden" 
                        id="logo-upload-input"
                      />
                      <label htmlFor="logo-upload-input" className="btn-secondary py-2 px-3 text-center block cursor-pointer text-[10px] font-bold uppercase tracking-wider border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                        Choose Logo
                      </label>
                    </div>
                  </div>
                </div>

                {/* Favicon Upload */}
                <div className="space-y-1.5">
                  <label>Upload Favicon (.ico/.png)</label>
                  <div className="flex items-center gap-3">
                    {brandingConfig.appFavicon ? (
                      <img src={brandingConfig.appFavicon} alt="Favicon Preview" className="w-10 h-10 object-contain rounded-lg border border-slate-200 p-1" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                        No Fav
                      </div>
                    )}
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFaviconUpload}
                        className="hidden" 
                        id="favicon-upload-input"
                      />
                      <label htmlFor="favicon-upload-input" className="btn-secondary py-2 px-3 text-center block cursor-pointer text-[10px] font-bold uppercase tracking-wider border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                        Choose Favicon
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-4 border-t border-slate-100">
                <label>External Public URL</label>
                <input 
                  type="text" 
                  className="input-field w-full" 
                  value={platformUrl}
                  onChange={e => setPlatformUrl(e.target.value)}
                />
              </div>
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-700 font-medium">Changes to Public URL may affect magic-link generation.</p>
              </div>
            </div>
          </section>

          {/* Timezone Configuration */}
          <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
            <div className="flex items-center gap-3 mb-8">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Timezone Configuration</h2>
            </div>
            <div className="space-y-6">
              <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-100">
                <button 
                  onClick={() => setTimezoneConfig({...timezoneConfig, mode: 'SERVER'})}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                    timezoneConfig.mode === 'SERVER' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Server Default
                </button>
                <button 
                  onClick={() => setTimezoneConfig({...timezoneConfig, mode: 'MANUAL'})}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                    timezoneConfig.mode === 'MANUAL' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Manual Setup
                </button>
              </div>

              {timezoneConfig.mode === 'SERVER' ? (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Detected Server Timezone</p>
                    <p className="text-[13px] text-blue-900 font-bold">{serverTimezone}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label>Manual Timezone</label>
                  <select 
                    className="input-field w-full appearance-none bg-white font-bold"
                    value={timezoneConfig.manualValue}
                    onChange={e => setTimezoneConfig({...timezoneConfig, manualValue: e.target.value})}
                  >
                    <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
                    <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                    <option value="UTC">Universal Coordinated Time (UTC)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                  </select>
                </div>
              )}
              
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  System timestamps in audit logs and reports will be adjusted according to this setting for consistent viewing.
                </p>
              </div>
            </div>
          </section>
        </div>
        )}

        {activeTab === 'database' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Database Configuration */}
          <form onSubmit={e => e.preventDefault()} className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
            <div className="flex items-center gap-3 mb-8">
              <Database className="w-5 h-5 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">Primary Database Configuration</h2>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-1.5">
                  <label>Database Host</label>
                  <input 
                    type="text" 
                    className="input-field w-full" 
                    value={dbConfig.host} 
                    onChange={e => setDbConfig({...dbConfig, host: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Port</label>
                  <input 
                    type="text" 
                    className="input-field w-full text-center" 
                    value={dbConfig.port}
                    onChange={e => setDbConfig({...dbConfig, port: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label>Username</label>
                  <input 
                    type="text" 
                    className="input-field w-full" 
                    value={dbConfig.user}
                    onChange={e => setDbConfig({...dbConfig, user: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Password</label>
                  <input 
                    type="password" 
                    autoComplete="new-password"
                    className="input-field w-full" 
                    value={dbConfig.password}
                    onChange={e => setDbConfig({...dbConfig, password: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label>Database Name</label>
                <input 
                  type="text" 
                  className="input-field w-full" 
                  value={dbConfig.database}
                  onChange={e => setDbConfig({...dbConfig, database: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleTestDb}
                  disabled={isTestingDb}
                  className="btn-secondary py-3 flex items-center justify-center gap-2 border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  {isTestingDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Test Connection
                </button>
                <button 
                  onClick={handleSaveDb}
                  disabled={isSavingDb}
                  className="btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {isSavingDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Config
                </button>
              </div>

              <AnimatePresence>
                {(dbTestStatus || dbSaveStatus) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={cn(
                      "p-3 rounded-xl border flex flex-col gap-2 text-[11px] font-bold",
                      (dbTestStatus?.success || dbSaveStatus?.success) ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {(dbTestStatus?.success || dbSaveStatus?.success) ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {dbTestStatus?.message || dbSaveStatus?.message}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>
        )}

        {activeTab === 'catalogs' && (
        <div className="space-y-8">
          {/* Dynamic Catalog Management */}
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                <List className="w-5 h-5 text-blue-600" />
                Resource Catalogs
              </h2>
              <p className="text-slate-500 text-xs font-semibold mt-1">Manage dynamic lists for Service Types and OS Templates</p>
            </div>
            <button 
              onClick={handleOpenAddCatalog}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Catalog Item
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* List Catalog Items */}
              {/* Service Types */}
              <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <h3 className="font-bold text-slate-900">Service Types</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{catalogs.filter(c => c.category === 'SERVICE_TYPE').length} Items</span>
                </div>
                <div className="space-y-3">
                  {catalogs.filter(c => c.category === 'SERVICE_TYPE').map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{item.name}</span>
                        <code className="text-[9px] text-slate-400 font-mono mt-0.5">{item.value}</code>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button 
                          onClick={() => handleOpenEditCatalog(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleRemoveCatalog(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* OS Templates */}
              <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-slate-900">OS Templates</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{catalogs.filter(c => c.category === 'OS_TEMPLATE').length} Items</span>
                </div>
                <div className="space-y-3">
                  {catalogs.filter(c => c.category === 'OS_TEMPLATE').map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{item.name}</span>
                        <code className="text-[9px] text-slate-400 font-mono mt-0.5">{item.value}</code>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button 
                          onClick={() => handleOpenEditCatalog(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleRemoveCatalog(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Support Ticket Categories */}
              <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 h-fit">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <LifeBuoy className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-bold text-slate-900">Support Ticket Categories</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{catalogs.filter(c => c.category === 'SUPPORT_TICKET_CATEGORY').length} Items</span>
                </div>
                <div className="space-y-3">
                  {catalogs.filter(c => c.category === 'SUPPORT_TICKET_CATEGORY').map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{item.name}</span>
                        <code className="text-[9px] text-slate-400 font-mono mt-0.5">{item.value}</code>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button 
                          onClick={() => handleOpenEditCatalog(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleRemoveCatalog(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

            {/* Identity Types */}
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 h-fit">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-slate-900">Vault Identity Types</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{catalogs.filter(c => c.category === 'IDENTITY_TYPE').length} Items</span>
              </div>
              <div className="space-y-3">
                {catalogs.filter(c => c.category === 'IDENTITY_TYPE').map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">{item.name}</span>
                      <code className="text-[9px] text-slate-400 font-mono mt-0.5">{item.value}</code>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <button 
                        onClick={() => handleOpenEditCatalog(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleRemoveCatalog(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Physical Asset Types */}
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 h-fit">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-bold text-slate-900">Physical Asset Types</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{catalogs.filter(c => c.category === 'PHYSICAL_ASSET_TYPE').length} Items</span>
              </div>
              <div className="space-y-3">
                {catalogs.filter(c => c.category === 'PHYSICAL_ASSET_TYPE').map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">{item.name}</span>
                      <code className="text-[9px] text-slate-400 font-mono mt-0.5">{item.value}</code>
                      {item.description && (
                        <span className="text-[10px] text-slate-500 font-medium mt-1 leading-normal">{item.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <button 
                        onClick={() => handleOpenEditCatalog(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleRemoveCatalog(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Task Tracker Types */}
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 h-fit">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900">Task Tracker Types</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{catalogs.filter(c => c.category === 'TASK_TYPE').length} Items</span>
              </div>
              <div className="space-y-3">
                {catalogs.filter(c => c.category === 'TASK_TYPE').map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">{item.name}</span>
                      <code className="text-[9px] text-slate-400 font-mono mt-0.5">{item.value}</code>
                      {item.description && (
                        <span className="text-[10px] text-slate-500 font-medium mt-1 leading-normal">{item.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <button 
                        onClick={() => handleOpenEditCatalog(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleRemoveCatalog(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
        )}


        {activeTab === 'api-portal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Token Generator Card */}
          <div className="lg:col-span-1 space-y-6">
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
              <div className="flex items-center gap-3 mb-6">
                <Key className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Personal Access Token</h2>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-6">
                Generate long-lived JWT API tokens to securely integrate external systems (e.g. n8n, automated scripts) with YATO.
              </p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expiration Period</label>
                  <select 
                    value={patDuration} 
                    onChange={e => setPatDuration(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="365">1 Year (365 Days)</option>
                    <option value="0">Never Expire</option>
                  </select>
                </div>

                <button 
                  onClick={handleGeneratePat}
                  disabled={isGeneratingPat}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2.5 font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-blue-600/10 disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {isGeneratingPat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Generate Token
                </button>
              </div>

              {patToken && (
                <div className="mt-8 p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">Your API Token (JWT)</span>
                    <button 
                      onClick={handleCopyToken}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors uppercase"
                    >
                      {copiedToken ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-white border border-emerald-100/50 rounded-xl p-3 font-mono text-[9px] text-slate-700 break-all select-all relative max-h-32 overflow-y-auto custom-scrollbar">
                    {patToken}
                  </div>
                  <p className="text-[9px] text-emerald-800/80 leading-normal font-medium">
                    ⚠️ <span className="font-bold">Security Notice:</span> Make sure to copy this token now. It will not be shown again for security reasons.
                    <br />
                    <span className="font-bold">Expires:</span> {patExpiresAt === "Never" ? "Never" : new Date(patExpiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </section>

            {/* Swagger Documentation Banner */}
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 bg-gradient-to-br from-slate-900 to-slate-950 text-white border-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Activity className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider">Swagger API Explorer</h2>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed mb-6 font-medium">
                Access the complete, interactive OpenAPI specification of YATO directly from your server to test requests in real-time.
              </p>
              <a 
                href="/api/docs" 
                target="_blank" 
                rel="noreferrer"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center block transition-colors shadow-lg shadow-blue-600/10"
              >
                Launch API Explorer
              </a>
            </section>
          </div>

          {/* Code Integration Templates Card */}
          <div className="lg:col-span-2">
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 h-full flex flex-col">
              <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">Integration Code Templates</h2>
                </div>
                <button 
                  onClick={() => {
                    const codes: Record<string, string> = {
                      curl: `curl -X GET \\\n  -H "Authorization: Bearer ${patToken || '<YOUR_TOKEN>'}" \\\n  "http://localhost:4000/api/vm-inventory"`,
                      js: `const token = "${patToken || '<YOUR_TOKEN>'}";\n\nfetch("http://localhost:4000/api/vm-inventory", {\n  method: "GET",\n  headers: {\n    "Authorization": \`Bearer \${token}\`,\n    "Content-Type": "application/json"\n  }\n})\n.then(res => res.json())\n.then(data => console.log("Inventory:", data))\n.catch(err => console.error("Error:", err));`,
                      python: `import requests\n\ntoken = "${patToken || '<YOUR_TOKEN>'}"\nheaders = {\n    "Authorization": f"Bearer {token}",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.get(\n    "http://localhost:4000/api/vm-inventory", \n    headers=headers\n)\nprint("Inventory:", response.json())`,
                      n8n: `{\n  "node": "HTTP Request",\n  "parameters": {\n    "method": "GET",\n    "url": "http://localhost:4000/api/vm-inventory",\n    "authentication": "predefined",\n    "headers": {\n      "Authorization": "Bearer ${patToken || '<YOUR_TOKEN>'}"\n    }\n  }\n}`
                    };
                    handleCopyCode(codes[selectedSnippet]);
                  }}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase shrink-0"
                >
                  {copiedCode ? "Copied Code!" : "Copy Code"}
                </button>
              </div>

              {/* Sub-tabs for Language Selection */}
              <div className="flex items-center gap-1.5 mb-6 p-1 bg-slate-100/80 rounded-xl w-fit border border-slate-200/40 shrink-0">
                <button 
                  onClick={() => setSelectedSnippet("curl")}
                  className={cn("px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wide", selectedSnippet === 'curl' ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800")}
                >
                  cURL
                </button>
                <button 
                  onClick={() => setSelectedSnippet("js")}
                  className={cn("px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wide", selectedSnippet === 'js' ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800")}
                >
                  JavaScript
                </button>
                <button 
                  onClick={() => setSelectedSnippet("python")}
                  className={cn("px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wide", selectedSnippet === 'python' ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800")}
                >
                  Python
                </button>
                <button 
                  onClick={() => setSelectedSnippet("n8n")}
                  className={cn("px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wide", selectedSnippet === 'n8n' ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800")}
                >
                  n8n Workflow
                </button>
              </div>

              {/* Code Sandbox Display */}
              <div className="flex-1 min-h-[300px] bg-slate-900 rounded-2xl p-6 font-mono text-xs text-slate-300 overflow-auto border border-slate-800 shadow-inner relative max-h-[450px]">
                {selectedSnippet === 'curl' && (
                  <pre className="whitespace-pre-wrap break-all">
                    <span className="text-amber-500">curl</span> <span className="text-blue-400">-X</span> GET \<br />
                    {"  "}<span className="text-blue-400">-H</span> <span className="text-emerald-400">"Authorization: Bearer {patToken || '<YOUR_TOKEN>'}"</span> \<br />
                    {"  "}<span className="text-emerald-400">"http://localhost:4000/api/vm-inventory"</span>
                  </pre>
                )}

                {selectedSnippet === 'js' && (
                  <pre className="whitespace-pre-wrap break-all leading-relaxed">
                    <span className="text-purple-400">const</span> token = <span className="text-emerald-400">"{patToken || '<YOUR_TOKEN>'}"</span>;<br /><br />
                    <span className="text-purple-400">fetch</span>(<span className="text-emerald-400">"http://localhost:4000/api/vm-inventory"</span>, &#123;<br />
                    {"  "}method: <span className="text-emerald-400">"GET"</span>,<br />
                    {"  "}headers: &#123;<br />
                    {"    "}<span className="text-emerald-400">"Authorization"</span>: <span className="text-emerald-400">{"`Bearer ${token}`"}</span>,<br />
                    {"    "}<span className="text-emerald-400">"Content-Type"</span>: <span className="text-emerald-400">"application/json"</span><br />
                    {"  "}&#125;<br />
                    &#125;)<br />
                    .<span className="text-blue-400">then</span>(<span className="text-orange-400">res</span> =&gt; res.<span className="text-blue-400">json</span>())<br />
                    .<span className="text-blue-400">then</span>(<span className="text-orange-400">data</span> =&gt; console.<span className="text-blue-400">log</span>(<span className="text-emerald-400">"Inventory:"</span>, data))<br />
                    .<span className="text-blue-400">catch</span>(<span className="text-orange-400">err</span> =&gt; console.<span className="text-blue-400">error</span>(<span className="text-emerald-400">"Error:"</span>, err));
                  </pre>
                )}

                {selectedSnippet === 'python' && (
                  <pre className="whitespace-pre-wrap break-all leading-relaxed">
                    <span className="text-purple-400">import</span> requests<br /><br />
                    token = <span className="text-emerald-400">"{patToken || '<YOUR_TOKEN>'}"</span><br />
                    headers = &#123;<br />
                    {"    "}<span className="text-emerald-400">"Authorization"</span>: <span className="text-emerald-400">f"Bearer &#123;token&#125;"</span>,<br />
                    {"    "}<span className="text-emerald-400">"Content-Type"</span>: <span className="text-emerald-400">"application/json"</span><br />
                    &#125;<br /><br />
                    response = requests.<span className="text-blue-400">get</span>(<br />
                    {"    "}<span className="text-emerald-400">"http://localhost:4000/api/vm-inventory"</span>, <br />
                    {"    "}headers=headers<br />
                    )<br />
                    <span className="text-purple-400">print</span>(<span className="text-emerald-400">"Inventory:"</span>, response.<span className="text-blue-400">json</span>())
                  </pre>
                )}

                {selectedSnippet === 'n8n' && (
                  <pre className="whitespace-pre-wrap break-all leading-relaxed">
                    &#123;<br />
                    {"  "}<span className="text-purple-400">"node"</span>: <span className="text-emerald-400">"HTTP Request"</span>,<br />
                    {"  "}<span className="text-purple-400">"parameters"</span>: &#123;<br />
                    {"    "}<span className="text-purple-400">"method"</span>: <span className="text-emerald-400">"GET"</span>,<br />
                    {"    "}<span className="text-purple-400">"url"</span>: <span className="text-emerald-400">"http://localhost:4000/api/vm-inventory"</span>,<br />
                    {"    "}<span className="text-purple-400">"authentication"</span>: <span className="text-emerald-400">"predefined"</span>,<br />
                    {"    "}<span className="text-purple-400">"headers"</span>: &#123;<br />
                    {"      "}<span className="text-emerald-400">"Authorization"</span>: <span className="text-emerald-400">"Bearer {patToken || '<YOUR_TOKEN>'}"</span><br />
                    {"    "}&#125;<br />
                    {"  "}&#125;<br />
                    &#125;
                  </pre>
                )}
              </div>
            </section>
          </div>
        </div>
        )}

        {activeTab === 'tuning' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Tuning Configurations */}
          <form onSubmit={(e) => handleSaveTuning(e, true)} className="space-y-8">
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
              <div className="flex items-center gap-3 mb-8">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">System Tuning & Scaling</h2>
              </div>
              
              <div className="space-y-6">
                {/* Node RAM selection */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Node.js V8 Heap Memory Limit</label>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { label: "512MB", val: "512" },
                      { label: "1.0GB", val: "1024" },
                      { label: "2.0GB", val: "2048" },
                      { label: "4.0GB", val: "4096" },
                      { label: "8.0GB", val: "8192" },
                      { label: "16.0GB", val: "16384" }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setTuningConfig({ ...tuningConfig, ramLimit: opt.val })}
                        className={cn(
                          "py-3 rounded-xl border text-xs font-bold transition-all uppercase tracking-wider",
                          tuningConfig.ramLimit === opt.val
                            ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
                    Set a higher allocation for large environments with active socket terminal flows to avoid memory limit issues.
                  </p>
                </div>

                {/* Database Connection Pool Slider */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Database Connection Pool Limit</label>
                    <span className={cn(
                      "font-bold px-2 py-0.5 rounded text-xs transition-all",
                      parseInt(tuningConfig.dbPoolLimit) > 100 
                        ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200/50" 
                        : "bg-indigo-50 text-indigo-700"
                    )}>
                      {tuningConfig.dbPoolLimit} connections
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    step="5"
                    value={tuningConfig.dbPoolLimit}
                    onChange={(e) => setTuningConfig({ ...tuningConfig, dbPoolLimit: e.target.value })}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                  />
                  {parseInt(tuningConfig.dbPoolLimit) > 100 && (
                    <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider px-1 animate-pulse">
                      ⚠️ Warning: Ensure postgresql.conf `max_connections` is configured higher than this limit!
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
                    Controls Prisma `connection_limit`. General formula: `(CPU * 2) + Storage Spindles`. Default is 20.
                  </p>
                </div>

                {/* Caching duration */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Cache Time-To-Live (Seconds)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="10"
                      max="86400"
                      className="input-field w-full pr-12 font-bold text-slate-800"
                      value={tuningConfig.cacheTtlSeconds}
                      onChange={(e) => setTuningConfig({ ...tuningConfig, cacheTtlSeconds: e.target.value })}
                    />
                    <div className="absolute inset-y-0 right-4 flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pointer-events-none">
                      Secs
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
                    Global duration of dynamic caches in Redis (e.g. statistics, inventory indexes). Default is 600s.
                  </p>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={(e) => handleSaveTuning(e, false)}
                    disabled={isSavingTuning}
                    className="flex-1 btn-secondary py-3 flex items-center justify-center gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Save (No Restart)
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTuning}
                    className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
                  >
                    {isSavingTuning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save & Apply Restart
                  </button>
                </div>
              </div>
            </section>
          </form>

          <div className="space-y-8">
            {/* Queue & Worker Concurrency */}
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
              <div className="flex items-center gap-3 mb-8">
                <Zap className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">Queue & Worker Parallelism</h2>
              </div>

              <div className="space-y-6">
                {/* Notifications worker concurrency */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Notification Delivery Concurrency</label>
                    <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-xs">
                      {tuningConfig.notificationConcurrency} Workers
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="input-field w-full font-bold text-slate-800"
                    value={tuningConfig.notificationConcurrency}
                    onChange={(e) => setTuningConfig({ ...tuningConfig, notificationConcurrency: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
                    Number of dynamic workers sending emails, whatsapp and telegram events concurrently from BullMQ.
                  </p>
                </div>
              </div>
            </section>

            {/* Manual Lifecycle Control Card */}
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 border-t border-rose-100 bg-rose-50/20">
              <div className="flex items-center gap-3 mb-6">
                <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-900">Maintenance & Service Control</h2>
              </div>
              <p className="text-[11px] text-slate-600 font-medium mb-6 leading-relaxed">
                Triggering a manual system restart will terminate current Node processes immediately. Since containers run under Docker restart policies, all service processes will safely and gracefully reboot automatically within seconds.
              </p>
              <button
                type="button"
                onClick={handleManualRestart}
                className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 bg-rose-600 border-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/15"
              >
                <Monitor className="w-4 h-4" />
                Gracefully Restart System Services
              </button>
            </section>
          </div>
        </div>
        )}

        {activeTab === 'hrm-security' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-fade-in">
            {/* IP Whitelisting Configurations Card */}
            <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
              <div className="flex items-center gap-3 mb-8">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">HRM Anti-Fraud Security Settings</h2>
              </div>

              <div className="space-y-6">
                {/* Office IP Toggle */}
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="space-y-0.5">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider">Office IP Whitelisting</label>
                    <p className="text-[10px] text-slate-500 font-medium">Restrict clock-in/out exclusively to registered corporate IPs.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={officeIpEnabled}
                      onChange={(e) => setOfficeIpEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Whitelist IP input field */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Authorized Corporate IP Addresses</label>
                  <textarea 
                    className="input-field w-full p-4 font-mono text-xs text-slate-800 bg-white"
                    placeholder="e.g. 127.0.0.1, 103.14.22.81, 182.253.112.5"
                    rows={4}
                    value={officeIpWhitelist}
                    onChange={(e) => setOfficeIpWhitelist(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
                    Provide a comma-separated list of your corporate network's public IP addresses. When whitelisting is enabled, all Clock-in/out attempts from unlisted IPs will be automatically blocked.
                  </p>
                </div>

                {/* Session Timeout Select */}
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Platform Session Timeout (Auto Logout)</span>
                  </label>
                  <select 
                    className="input-field w-full bg-slate-50"
                    value={sessionTimeout}
                    onChange={e => setSessionTimeout(e.target.value)}
                  >
                    <option value="15">15 Minutes (Default / Recommended)</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">1 Hour</option>
                    <option value="240">4 Hours</option>
                    <option value="480">8 Hours</option>
                    <option value="1440">1 Day</option>
                    <option value="10080">7 Days</option>
                  </select>
                  <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
                    Set the duration of inactivity before users are automatically logged out of their sessions to protect administrative data.
                  </p>
                </div>

                {/* Save Configurations button */}
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Security Configurations
                </button>
              </div>
            </section>

            {/* Smart Diagnostics Card */}
            <div className="space-y-8">
              <section className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10 bg-slate-50/30 border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <Globe className="w-5 h-5 text-blue-600 animate-pulse" />
                  <h2 className="text-sm font-bold text-slate-900">Administrator IP Diagnostics</h2>
                </div>
                <p className="text-[11px] text-slate-600 font-medium mb-6 leading-relaxed">
                  To prevent locking yourself out of standard HRM administrative functionalities, verify your current network's public IP address before saving changes.
                </p>

                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">Detected Public IP:</span>
                    <span className="font-mono font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
                      {detectedIp || "Detecting..."}
                    </span>
                  </div>

                  {detectedIp && (
                    <button
                      onClick={() => {
                        const currentList = officeIpWhitelist.split(',').map(x => x.trim()).filter(Boolean);
                        if (!currentList.includes(detectedIp)) {
                          currentList.push(detectedIp);
                          setOfficeIpWhitelist(currentList.join(', '));
                        }
                      }}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider text-center block transition-colors cursor-pointer"
                    >
                      🚀 Add My Current IP to Whitelist
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>

      <AnimatePresence>
        {isAddCatalogModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 relative"
            >
              <button 
                onClick={() => setIsAddCatalogModalOpen(false)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  {editingCatalogId ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    {editingCatalogId ? "Edit Catalog Item" : "Add Catalog Item"}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    {editingCatalogId ? "Modify an existing resource parameter" : "Create a new resource parameter"}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Catalog Category</label>
                  <select 
                    className="input-field w-full bg-slate-50"
                    value={newCatalog.category}
                    onChange={e => setNewCatalog({...newCatalog, category: e.target.value})}
                  >
                    <option value="SERVICE_TYPE">Managed Service Type</option>
                    <option value="OS_TEMPLATE">OS Template (VM)</option>
                    <option value="IDENTITY_TYPE">Vault Identity Type</option>
                    <option value="PHYSICAL_ASSET_TYPE">Physical Asset Type</option>
                    <option value="TASK_TYPE">Task Type (Tracker)</option>
                    <option value="SUPPORT_TICKET_CATEGORY">Support Ticket Category</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Display Name</label>
                  <input 
                    type="text" 
                    className="input-field w-full bg-slate-50" 
                    placeholder="e.g. MongoDB Cluster"
                    value={newCatalog.name}
                    onChange={e => setNewCatalog({...newCatalog, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">System Value</label>
                  <input 
                    type="text" 
                    className="input-field w-full bg-slate-50 font-mono text-sm" 
                    placeholder="e.g. mongodb"
                    value={newCatalog.value}
                    onChange={e => setNewCatalog({...newCatalog, value: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Description / Notes</label>
                  <textarea 
                    className="input-field w-full bg-slate-50 py-2.5 px-4 text-xs font-semibold" 
                    placeholder="Enter description or notes for this asset type..."
                    rows={2}
                    value={newCatalog.description || ""}
                    onChange={e => setNewCatalog({...newCatalog, description: e.target.value})}
                  />
                </div>

                {(newCatalog.category === "IDENTITY_TYPE" || newCatalog.category === "PHYSICAL_ASSET_TYPE" || newCatalog.category === "SERVICE_TYPE") && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Dynamic Custom Fields</label>
                      <button 
                        onClick={handleAddCustomField}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Field
                      </button>
                    </div>
                    
                    {(!newCatalog.metadata?.customFields || newCatalog.metadata.customFields.length === 0) && (
                      <p className="text-[11px] text-slate-400 font-medium p-3 bg-slate-50 rounded-xl text-center border border-slate-100 border-dashed">
                        No custom fields defined. This item will only use default basic fields.
                      </p>
                    )}

                    <div className="space-y-3.5 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                      {newCatalog.metadata?.customFields?.map((field: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-2.5 bg-slate-50/60 p-3 rounded-2xl border border-slate-100/80 shadow-sm">
                          <div className="flex items-center gap-2">
                            <input 
                              type="text"
                              placeholder="Field Name (e.g. Purchase Date)"
                              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500 shadow-sm"
                              value={field.name}
                              onChange={(e) => handleUpdateCustomField(idx, 'name', e.target.value)}
                            />
                            <select
                              value={field.type || "text"}
                              onChange={(e) => handleUpdateCustomField(idx, 'type', e.target.value)}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500 cursor-pointer shadow-sm text-slate-700 font-sans"
                            >
                              <option value="text">TEXT</option>
                              <option value="number">NUMBER</option>
                              <option value="datetime">DATE & TIME</option>
                              <option value="boolean">BOOLEAN / TOGGLE</option>
                              <option value="password">SECURED SECRET</option>
                            </select>
                          </div>
                          
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100/40">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="accent-blue-600 rounded"
                                checked={field.isRequired}
                                onChange={(e) => handleUpdateCustomField(idx, 'isRequired', e.target.checked)}
                              />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Required Field</span>
                            </label>
                            
                            <button 
                              onClick={() => handleRemoveCustomField(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleAddCatalog}
                  disabled={!newCatalog.name || !newCatalog.value}
                  className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                >
                  {editingCatalogId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editingCatalogId ? "Update Catalog Item" : "Save to Catalog"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRestarting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-slate-900 text-white rounded-3xl p-10 max-w-md w-full shadow-2xl border border-slate-800 text-center relative overflow-hidden"
            >
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>

              <h2 className="text-xl font-bold tracking-tight mb-2">Rebooting Gateway Channel</h2>
              <p className="text-xs font-semibold text-slate-400 mb-8 leading-relaxed">
                {restartMessage}
              </p>

              {restartCountdown > 0 ? (
                <div className="relative inline-flex items-center justify-center mb-6">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      className="text-slate-800"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="transparent"
                      r="36"
                      cx="40"
                      cy="40"
                    />
                    <circle
                      className="text-indigo-500 transition-all duration-1000"
                      strokeWidth="4"
                      strokeDasharray={226}
                      strokeDashoffset={226 - (226 * restartCountdown) / 15}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="36"
                      cx="40"
                      cy="40"
                    />
                  </svg>
                  <span className="absolute text-lg font-extrabold font-mono tracking-tight text-white">
                    {restartCountdown}s
                  </span>
                </div>
              ) : (
                <div className="py-4 flex flex-col items-center gap-2">
                  <div className="flex gap-1.5 items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Awaiting Handshake</span>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-4">
                DO NOT REFRESH OR CLOSING THE WINDOW
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
