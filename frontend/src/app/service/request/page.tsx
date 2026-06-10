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
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function NewServiceRequestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    serviceName: "",
    type: "",
    plan: "Standard",
    environment: "Production",
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
    mutation.mutate(formData);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto">
        <header className="mb-10">
          <Link href="/service/inventory" className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold uppercase tracking-widest text-[10px]">Back to Inventory</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div>
              <h1 className="page-title">Request New Service</h1>
              <p className="text-slate-400 text-[13px] font-bold uppercase tracking-widest mt-1">Initialize managed resource provisioning</p>
            </div>
          </div>
        </header>

        <div className="glass-card ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/5">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 col-span-full">
                <label>Service Identifier / Instance Name</label>
                <div className="relative group">
                  <Layout className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    required
                    className="input-field pl-12 w-full bg-slate-50/50" 
                    placeholder="e.g. Redis-Cache-01"
                    value={formData.serviceName}
                    onChange={e => setFormData({...formData, serviceName: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label>Managed Service Type</label>
                <div className="relative group">
                  <Settings2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select 
                    required
                    className="input-field pl-12 w-full appearance-none bg-slate-50/50 font-bold pr-10"
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

              <div className="space-y-2">
                <label>Target Environment</label>
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select 
                    className="input-field pl-12 w-full appearance-none bg-slate-50/50 font-bold pr-10"
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


              <div className="space-y-2 col-span-full">
                <label>Configuration Notes</label>
                <textarea 
                  rows={4}
                  className="input-field w-full resize-none bg-slate-50/50"
                  placeholder="Specific configs or business purpose..."
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex gap-4">
              <button 
                type="submit" 
                disabled={mutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20"
              >
                {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
                <span className="font-bold text-base uppercase tracking-widest">Submit Provisioning Request</span>
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
