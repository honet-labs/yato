"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { 
  Layers, 
  Plus, 
  Search, 
  Loader2, 
  Clock, 
  MoreVertical,
  X,
  Package,
  Zap,
  Layout,
  Globe,
  Settings2,
  ChevronDown,
  Hash
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ServiceRequest {
  id: string;
  ticketId: string;
  serviceName: string;
  version: string;
  environment: string;
  status: string;
  createdAt: string;
}

export default function ServiceRequestsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    serviceName: "",
    type: "Database (PostgreSQL)",
    plan: "Standard",
    environment: "Production",
    notes: ""
  });

  const { data: requests, isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["service-requests"],
    queryFn: async () => {
      try {
        const response = await api.get("/service/request/");
        return response.data;
      } catch (e: any) { return []; }
    },
  });

  const { data: serviceTypes } = useQuery<any[]>({
    queryKey: ["catalog", "SERVICE_TYPE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=SERVICE_TYPE");
      return response.data;
    },
  });

  const mutation = useMutation({
    mutationFn: (newReq: any) => api.post("/service/request/", newReq),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      setIsModalOpen(false);
      setFormData({ serviceName: "", type: "Database (PostgreSQL)", plan: "Standard", environment: "Production", notes: "" });
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
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="page-title">Service Provisioning</h1>
            <p className="text-slate-400 text-[13px] font-bold uppercase tracking-widest mt-1">Managed service lifecycle and tracking</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2.5 px-6 shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-5 h-5" />
            <span className="font-bold uppercase tracking-wider">New Service Request</span>
          </button>
        </header>

        <div className="flex gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input type="text" className="input-field pl-11 py-3 w-full" placeholder="Search by Ticket ID or Service Name..." />
          </div>
        </div>

        <div className="glass-card !p-0 overflow-hidden ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p className="text-xs font-bold uppercase tracking-widest">Loading queue...</p>
            </div>
          ) : requests?.length === 0 ? (
            <div className="py-32 text-center">
              <Layers className="w-12 h-12 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">No active service requests found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ticket ID</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Item</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Environment</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timeline</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {requests?.map((req) => (
                    <motion.tr 
                      key={req.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{req.ticketId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{req.serviceName}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{req.version}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">{req.environment}</span>
                      </td>
                      <td className="px-6 py-4 text-[11px] font-bold text-slate-400 flex items-center gap-1.5 py-7">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${
                          req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          req.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-400 hover:text-slate-900 transition-all">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Request New Service</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Initialize managed resource provisioning</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5 col-span-2">
                    <label>Service Identifier / Instance Name</label>
                    <div className="relative group">
                      <Layout className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        required
                        className="input-field pl-12 w-full" 
                        placeholder="e.g. Redis-Cache-01"
                        value={formData.serviceName}
                        onChange={e => setFormData({...formData, serviceName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label>Managed Service Type</label>
                    <div className="relative group">
                      <Settings2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select 
                        className="input-field pl-12 w-full appearance-none bg-white font-bold pr-10"
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

                  <div className="space-y-1.5">
                    <label>Target Environment</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select 
                        className="input-field pl-12 w-full appearance-none bg-white font-bold pr-10"
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

                  <div className="space-y-1.5 col-span-2">
                    <label>Select Performance Plan</label>
                    <div className="grid grid-cols-2 gap-4">
                      {['Standard', 'High-Performance'].map(plan => (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => setFormData({...formData, plan})}
                          className={cn(
                            "py-4 rounded-2xl border font-bold text-[11px] uppercase tracking-wider transition-all",
                            formData.plan === plan ? "bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-600/20" : "bg-white text-slate-500 border-slate-200 hover:border-blue-400"
                          )}
                        >
                          {plan}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label>Configuration Notes</label>
                    <textarea 
                      rows={3}
                      className="input-field w-full py-4 resize-none"
                      placeholder="Specific configs or business purpose..."
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={mutation.isPending}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-3 mt-4 shadow-xl shadow-blue-600/20"
                >
                  {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
                  <span className="font-bold text-base uppercase tracking-widest">Submit Provisioning Request</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
