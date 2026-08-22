"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { 
  Zap, 
  Loader2, 
  Layout, 
  Settings2, 
  Globe, 
  ChevronDown, 
  Package,
  ArrowLeft,
  Lock,
  User,
  Hash,
  Link as LinkIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function NewServiceRequestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    serviceName: "",
    type: "",
    plan: "Standard",
    environment: "Production",
    category: "",
    tags: [] as string[],
    endpoint: "",
    address: "",
    port: "",
    username: "",
    password: "",
    notes: ""
  });

  const { data: serviceTypes } = useQuery({
    queryKey: ["catalog", "SERVICE_TYPE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=SERVICE_TYPE");
      return response.data;
    },
  });

  const mutation = useMutation({
    mutationFn: (newReq: any) => api.post("/service/request/", newReq),
    onSuccess: () => {
      router.push("/tickets");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      port: formData.port ? parseInt(formData.port) : undefined
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            <header className="mb-10">
              <Link href="/service/inventory" className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors mb-6 group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="font-bold uppercase tracking-widest text-[10px]">Back to Inventory</span>
              </Link>
              
              <div className="mb-2">
                <PageHeader title="Request New Access Service" subtitle="Initialize managed resource provisioning" />
              </div>
            </header>

            <div className="glass-card shadow-xl shadow-slate-200/5">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Service Name */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Service Identifier / Instance Name</label>
                    <div className="relative group">
                      <Layout className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        required
                        className="input-field pl-12 w-full bg-white" 
                        placeholder="e.g. Redis-Cache-01"
                        value={formData.serviceName}
                        onChange={e => setFormData({...formData, serviceName: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Target Environment */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Target Environment</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select 
                        className="input-field pl-12 w-full appearance-none bg-white pr-10 font-bold"
                        value={formData.environment}
                        onChange={e => setFormData({...formData, environment: e.target.value})}
                      >
                        <option value="Production">Production</option>
                        <option value="Staging">Staging</option>
                        <option value="Development">Development</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Managed Service Type */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Managed Service Type</label>
                    <div className="relative group">
                      <Settings2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select 
                        required
                        className="input-field pl-12 w-full appearance-none bg-white pr-10 font-bold"
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value})}
                      >
                        <option value="" disabled>Select Service Type</option>
                        {serviceTypes?.map(type => (
                          <option key={type.id} value={type.value}>{type.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Endpoint / URL */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Endpoint / URL (Optional)</label>
                    <div className="relative group">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        className="input-field pl-12 w-full bg-white" 
                        placeholder="e.g. http://10.10.1.50:5678"
                        value={formData.endpoint}
                        onChange={e => setFormData({...formData, endpoint: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Category (Optional)</label>
                    <div className="relative group">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select 
                        className="input-field pl-12 w-full appearance-none bg-white pr-10 font-bold"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
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
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* IP Address / Host */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">IP Address / Host (Optional)</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        className="input-field pl-12 w-full bg-white" 
                        placeholder="e.g. 10.10.1.50"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Port */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Port (Optional)</label>
                    <div className="relative group">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="number" 
                        className="input-field pl-12 w-full bg-white" 
                        placeholder="e.g. 3306"
                        value={formData.port}
                        onChange={e => setFormData({...formData, port: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Username (Optional)</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        className="input-field pl-12 w-full bg-white" 
                        placeholder="e.g. admin"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Password (Optional)</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="password" 
                        className="input-field pl-12 w-full bg-white" 
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Tags - Full Width */}
                <div className="space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Tags (Optional)</label>
                  <input 
                    type="text" 
                    className="input-field w-full bg-white" 
                    placeholder="Comma-separated tags (e.g. production, critical, pci)"
                    value={formData.tags.join(', ')}
                    onChange={e => {
                      const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                      setFormData({...formData, tags});
                    }}
                  />
                </div>

                {/* Notes Section - Full Width */}
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-xs">Configuration Notes</label>
                  <textarea 
                    rows={4}
                    className="input-field w-full resize-none bg-white"
                    placeholder="Specific configs or business purpose..."
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={mutation.isPending}
                    className="btn-primary w-full flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20"
                  >
                    {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
                    <span className="font-bold text-base uppercase tracking-wider">Submit Provisioning Request</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
