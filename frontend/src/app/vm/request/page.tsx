"use client";
import { PageHeader } from "@/components/PageHeader";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Monitor, 
  Cpu, 
  Database, 
  Layout, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  Server,
  ArrowLeft,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { MobileNav } from "@/components/MobileNav";

export default function VmRequestPage() {
  const router = useRouter();
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    hostname: "",
    environment: "Production",
    osTemplate: "",
    cpu: 2,
    ram: 4,
    disk: 50,
    notes: "",
    hypervisor: "manual" // Default fallback
  });

  const { data: osTemplates } = useQuery<any[]>({
    queryKey: ["catalog", "OS_TEMPLATE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=OS_TEMPLATE");
      return response.data;
    },
  });

  useEffect(() => {
    if (osTemplates && osTemplates.length > 0 && !formData.osTemplate) {
      setFormData(prev => ({ ...prev, osTemplate: osTemplates[0].name }));
    }
  }, [osTemplates]);

  const mutation = useMutation({
    mutationFn: (newRequest: any) => api.post("/vm/request/", newRequest),
    onSuccess: () => {
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/tickets");
      }, 1500);
      setFormData({
        hostname: "", environment: "Production", osTemplate: osTemplates && osTemplates.length > 0 ? osTemplates[0].name : "",
        cpu: 2, ram: 4, disk: 50, notes: "", hypervisor: "manual"
      });
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
        <div className="max-w-3xl mx-auto">
        <header className="mb-10">
          <Link href="/vm/inventory" className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold uppercase tracking-widest text-[10px]">Back to Inventory</span>
          </Link>

          <div className="mb-2">
            <PageHeader title="Request New VirtualMachine" subtitle="Deploy new infrastructure resource" />
          </div>
        </header>

        <div>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="glass-card space-y-10">
              {/* Primary Configuration */}
              <div className="grid grid-cols-1 gap-10">
                <div className="space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider">Hostname / Instance Name</label>
                  <div className="relative group">
                    <Monitor className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. web-prod-01"
                      className="input-field pl-12 w-full bg-white" 
                      value={formData.hostname}
                      onChange={e => setFormData({...formData, hostname: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Template & Environment - Stacked for more space */}
              <div className="space-y-8 pt-6 border-t border-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider">Operating System Template</label>
                    <div className="relative group">
                      <Layout className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <select 
                        required
                        className="input-field pl-12 w-full appearance-none bg-white"
                        value={formData.osTemplate}
                        onChange={e => setFormData({...formData, osTemplate: e.target.value})}
                      >
                        <option value="" disabled>Select OS Template</option>
                        {osTemplates?.map(os => (
                          <option key={os.id} value={os.name}>{os.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-slate-500 font-bold uppercase tracking-wider">Placement Environment</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['Production', 'Staging', 'Development'].map(env => (
                        <button
                          key={env}
                          type="button"
                          onClick={() => setFormData({...formData, environment: env})}
                          className={cn(
                            "py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all border",
                            formData.environment === env 
                              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20" 
                              : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
                          )}
                        >
                          {env}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hardware Specifications */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-50">
                <div className="space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5" /> vCPU Cores
                  </label>
                  <input 
                    type="number" 
                    className="input-field w-full" 
                    value={formData.cpu}
                    onChange={e => setFormData({...formData, cpu: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-3.5 h-3.5" /> RAM (GB)
                  </label>
                  <input 
                    type="number" 
                    className="input-field w-full" 
                    value={formData.ram}
                    onChange={e => setFormData({...formData, ram: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-3.5 h-3.5" /> System Disk (GB)
                  </label>
                  <input 
                    type="number" 
                    className="input-field w-full" 
                    value={formData.disk}
                    onChange={e => setFormData({...formData, disk: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              {/* Notes Section - Full Width */}
              <div className="space-y-2 pt-4 border-t border-slate-50">
                <label className="text-slate-500 font-bold uppercase tracking-wider">Additional Provisioning Notes</label>
                <textarea 
                  rows={4}
                  className="input-field w-full resize-none"
                  placeholder="Mention specific requirements, package installs, or purpose..."
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
                  {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Monitor className="w-5 h-5" />}
                  <span className="font-bold text-base">Initialize Deployment Request</span>
                </button>
              </div>

              <AnimatePresence>
                {mutation.isError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 font-bold"
                  >
                    <AlertCircle className="w-5 h-5" />
                    Provisioning failed. Please verify resource availability.
                  </motion.div>
                )}
                {isSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700 font-bold"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Deployment request submitted to the queue.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>
      </div>
        </main>
      </div>
    </div>
  );
}

