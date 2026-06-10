"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { 
  Globe, 
  Search, 
  Loader2, 
  Link as LinkIcon, 
  Cpu, 
  Database, 
  MapPin, 
  Plus, 
  Trash2,
  X,
  Zap,
  Server,
  Network
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function AssetRelationshipsPage() {
  const queryClient = useQueryClient();
  const [rootAssetId, setRootAssetId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState("VM_TO_HYPERVISOR");
  
  // Queries
  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const response = await api.get("/assets");
      return response.data;
    },
  });

  const { data: relationships, isLoading: relsLoading } = useQuery({
    queryKey: ["asset-relationships-topology", rootAssetId],
    queryFn: async () => {
      const response = await api.get(`/assets/${rootAssetId}/relationship`);
      return response.data;
    },
    enabled: !!rootAssetId,
  });

  const addRelMutation = useMutation({
    mutationFn: (data: { sourceId: string; targetId: string; type: string }) => 
      api.post("/assets/relationship", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-relationships-topology"] });
      setTargetId("");
    },
  });

  const deleteRelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/relationship/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-relationships-topology"] });
    },
  });

  // Calculate coordinates for topological visual map
  const selectedRootAsset = assets?.find(a => a.id === rootAssetId);
  const inboundRels = relationships?.filter(r => r.targetId === rootAssetId) || [];
  const outboundRels = relationships?.filter(r => r.sourceId === rootAssetId) || [];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <MobileNav />
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0">
        <main className="page-container p-8 flex-1 flex flex-col lg:flex-row gap-8">
          
          {/* Controls column */}
          <div className="w-full lg:w-96 shrink-0 flex flex-col bg-white rounded-3xl border border-slate-100 p-8 shadow-sm h-fit">
            <header className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold text-slate-900 tracking-tight font-sans">Topology Mapper</h1>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">CMDB Infrastructure</p>
                </div>
              </div>
            </header>

            <div className="space-y-6">
              {/* Select Root Node */}
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Select Core Asset Node</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none rounded-xl px-4 py-3 text-sm transition-all font-bold"
                  value={rootAssetId}
                  onChange={(e) => setRootAssetId(e.target.value)}
                >
                  <option value="">Choose core node...</option>
                  {assets?.map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.assetCode} - {asset.hostname || 'Shared'}</option>
                  ))}
                </select>
              </div>

              {/* Add relationship form */}
              {rootAssetId && (
                <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Connect New Node Link</p>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-medium">Target Node</label>
                    <select 
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                    >
                      <option value="">Select target node...</option>
                      {assets?.filter(a => a.id !== rootAssetId).map(a => (
                        <option key={a.id} value={a.id}>{a.assetCode} - {a.hostname || 'Shared'}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-medium">Relation Link Type</label>
                    <select 
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold"
                      value={relationType}
                      onChange={(e) => setRelationType(e.target.value)}
                    >
                      <option value="VM_TO_HYPERVISOR">VM TO HYPERVISOR (VM -&gt; Host)</option>
                      <option value="SERVER_TO_RACK">SERVER TO RACK (Server -&gt; Rack)</option>
                      <option value="SWITCH_TO_DATACENTER">SWITCH TO DATACENTER (Switch -&gt; DC)</option>
                      <option value="SERVICE_TO_DATABASE">SERVICE TO DATABASE (App -&gt; DB)</option>
                    </select>
                  </div>

                  <button 
                    onClick={() => {
                      addRelMutation.mutate({
                        sourceId: rootAssetId,
                        targetId: targetId,
                        type: relationType
                      });
                    }}
                    disabled={addRelMutation.isPending || !targetId}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 transition-all disabled:opacity-50"
                  >
                    {addRelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Generate CMDB relation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Visual topology canvas column */}
          <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-100 p-8 shadow-sm min-h-[550px] relative overflow-hidden">
            <div className="absolute top-8 right-8 z-20 flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 border border-slate-100 rounded-full">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Active Topological Canvas</span>
            </div>

            {selectedRootAsset ? (
              <div className="flex-1 flex flex-col items-center justify-center relative w-full h-full">
                
                {/* SVG Curves Drawing Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <defs>
                    <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                      <stop offset="50%" stopColor="#6366f1" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                  
                  {/* Draw Inbound Links */}
                  {inboundRels.map((rel, idx) => {
                    const startX = 120;
                    const startY = 100 + idx * 110;
                    const endX = 350;
                    const endY = 250;
                    return (
                      <path 
                        key={rel.id}
                        d={`M ${startX} ${startY} C ${(startX + endX) / 2} ${startY}, ${(startX + endX) / 2} ${endY}, ${endX} ${endY}`}
                        fill="none"
                        stroke="url(#gradient-line)"
                        strokeWidth="2.5"
                        strokeDasharray="6,4"
                        className="animate-[dash_30s_linear_infinite]"
                      />
                    );
                  })}

                  {/* Draw Outbound Links */}
                  {outboundRels.map((rel, idx) => {
                    const startX = 350;
                    const startY = 250;
                    const endX = 580;
                    const endY = 100 + idx * 110;
                    return (
                      <path 
                        key={rel.id}
                        d={`M ${startX} ${startY} C ${(startX + endX) / 2} ${startY}, ${(startX + endX) / 2} ${endY}, ${endX} ${endY}`}
                        fill="none"
                        stroke="url(#gradient-line)"
                        strokeWidth="2.5"
                        strokeDasharray="6,4"
                        className="animate-[dash_30s_linear_infinite]"
                      />
                    );
                  })}
                </svg>

                {/* Nodes UI Container */}
                <div className="relative w-full h-[450px] z-10 flex items-center justify-between px-8">
                  
                  {/* Left Column: Inbound Partner Nodes */}
                  <div className="flex flex-col gap-6 w-48 justify-center h-full">
                    {inboundRels.map((rel) => (
                      <div key={rel.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 relative group hover:border-indigo-300 transition-all shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shadow-inner">
                          <Server className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-800 truncate max-w-[120px]">{rel.source.assetCode}</p>
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">{rel.type}</p>
                        </div>
                        {deleteRelMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin absolute top-2 right-2" />
                        ) : (
                          <button 
                            onClick={() => deleteRelMutation.mutate(rel.id)}
                            className="absolute -top-1.5 -right-1.5 p-1 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-100 text-slate-400 hover:text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Center Column: selected core root node */}
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-8 bg-indigo-600 border border-indigo-500 rounded-[2.5rem] flex flex-col items-center justify-center text-center shadow-2xl text-white w-64 relative ring-8 ring-indigo-50"
                  >
                    <div className="w-14 h-14 bg-white border border-indigo-400 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 shadow-xl">
                      <Network className="w-7 h-7" />
                    </div>
                    <h3 className="font-extrabold text-[15px]">{selectedRootAsset.assetCode}</h3>
                    <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mt-1">{selectedRootAsset.hostname || 'Shared Infrastructure'}</p>
                    <div className="mt-4 px-3 py-1 bg-indigo-700/60 rounded-full text-[9px] font-extrabold tracking-widest uppercase">
                      Core Node
                    </div>
                  </motion.div>

                  {/* Right Column: Outbound Partner Nodes */}
                  <div className="flex flex-col gap-6 w-48 justify-center h-full">
                    {outboundRels.map((rel) => (
                      <div key={rel.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 relative group hover:border-indigo-300 transition-all shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shadow-inner">
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-800 truncate max-w-[120px]">{rel.target.assetCode}</p>
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">{rel.type}</p>
                        </div>
                        {deleteRelMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin absolute top-2 right-2" />
                        ) : (
                          <button 
                            onClick={() => deleteRelMutation.mutate(rel.id)}
                            className="absolute -top-1.5 -right-1.5 p-1 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-100 text-slate-400 hover:text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <Network className="w-16 h-16 text-slate-200 mb-6 animate-pulse" />
                <h3 className="text-slate-400 font-bold text-base">Select core asset node</h3>
                <p className="text-slate-300 text-xs mt-2 max-w-sm">Pick any physical asset node on the left control panel to map outbound and inbound infrastructure relations dynamically</p>
              </div>
            )}

          </div>

        </main>
      </div>

      <style jsx global>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -1000;
          }
        }
      `}</style>
    </div>
  );
}
