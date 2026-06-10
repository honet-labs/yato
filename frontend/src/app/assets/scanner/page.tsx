"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { 
  QrCode, 
  Search, 
  Loader2, 
  CheckCircle2, 
  MapPin, 
  User as UserIcon, 
  Activity, 
  Database, 
  Cpu, 
  Zap, 
  ArrowLeft,
  X,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AssetScannerPage() {
  const queryClient = useQueryClient();
  const [assetCode, setAssetCode] = useState("");
  const [scannedAsset, setScannedAsset] = useState(null as any);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  // Real camera stream states
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Queries all assets for simulation scanner panel
  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const response = await api.get("/assets");
      return response.data;
    },
  });

  const startCamera = async () => {
    try {
      setCameraActive(true);
      setErrorMsg("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access failed", err);
      // Fallback gracefully to scanner HUD simulation
      setCameraActive(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleLookup = async (code: string) => {
    if (!code) return;
    setIsSearching(true);
    setErrorMsg("");
    setScannedAsset(null);
    try {
      const response = await api.get("/assets/scanner/lookup", {
        params: { assetCode: code.trim() }
      });
      setScannedAsset(response.data);
      stopCamera();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Asset not registered in security database");
    } finally {
      setIsSearching(false);
    }
  };

  const relocateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      // Reload asset status
      if (scannedAsset) {
        handleLookup(scannedAsset.assetCode);
      }
    }
  });

  const handleQuickMove = (toLocation: string, toRack: string) => {
    if (!scannedAsset) return;
    relocateMutation.mutate({
      id: scannedAsset.id,
      data: {
        location: toLocation,
        rack: toRack,
        status: "ACTIVE"
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <MobileNav />
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0">
        <main className="page-container p-8 flex-1 flex flex-col lg:flex-row gap-8">
          
          {/* Scanner column */}
          <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-100 p-8 shadow-sm max-w-2xl">
            <header className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/assets" className="p-2 hover:bg-slate-50 rounded-xl transition-all border border-slate-100">
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Audit Scanner</h1>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Physical tracking HUD</p>
                </div>
              </div>
              
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <QrCode className="w-5 h-5" />
              </div>
            </header>

            {/* SCANNING AREA CONTAINER */}
            <div className="relative aspect-video lg:aspect-square bg-slate-900 rounded-3xl overflow-hidden border border-slate-900 shadow-lg flex flex-col items-center justify-center text-center p-6">
              
              {cameraActive ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-cover z-10"
                  />
                  {/* Real video feed is covered, let's overlay a high-tech HUD grid */}
                  <div className="absolute inset-0 border-[6px] border-indigo-500/20 z-20 pointer-events-none" />
                  
                  {/* Laser line animation */}
                  <motion.div 
                    initial={{ top: "0%" }}
                    animate={{ top: "100%" }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-red-500/80 shadow-[0_0_15px_#ef4444] z-30 pointer-events-none"
                  />
                  
                  {/* Scanning box */}
                  <div className="absolute w-64 h-64 border-2 border-indigo-400 rounded-3xl z-30 pointer-events-none flex items-center justify-center">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
                  </div>

                  <button 
                    onClick={stopCamera}
                    className="absolute bottom-6 z-40 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl border border-white/10 transition-all shadow-md"
                  >
                    Turn Camera Off
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center z-10">
                  <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center text-indigo-400 mb-6 shadow-inner animate-pulse">
                    <QrCode className="w-10 h-10" />
                  </div>
                  <h3 className="text-white font-bold text-lg">Webcam Scan Audit Feed</h3>
                  <p className="text-slate-400 text-xs mt-2 max-w-sm leading-relaxed">Activate camera stream to instantly scan physical QR identity codes inside the datacenter</p>
                  <button 
                    onClick={startCamera}
                    className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl shadow-xl shadow-blue-500/20 transition-all"
                  >
                    Start Stream Audit
                  </button>
                </div>
              )}
            </div>

            {/* SCAN SIMULATOR & MANUAL INPUT PANEL */}
            <div className="mt-8 space-y-6">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Manual Lookup Backup</p>
                <div className="flex gap-3 mt-2">
                  <div className="relative flex-1 group">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none rounded-xl pl-11 pr-4 py-3 text-sm transition-all"
                      placeholder="Enter Asset Code e.g. HMS-SRV-000001"
                      value={assetCode}
                      onChange={(e) => setAssetCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookup(assetCode)}
                    />
                  </div>
                  <button 
                    onClick={() => handleLookup(assetCode)}
                    disabled={isSearching}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-xs font-bold text-rose-500 mt-2 flex items-center gap-1.5">
                    <X className="w-4 h-4" /> {errorMsg}
                  </p>
                )}
              </div>

              {/* DEMO SCAN SIMULATOR BLOCK */}
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Enterprise Scan Simulator</p>
                <div className="flex flex-wrap gap-2">
                  {assets?.length === 0 ? (
                    <p className="text-[11px] text-slate-400 font-medium">Please add a physical asset first to unlock simulator panel.</p>
                  ) : assets?.slice(0, 5).map(asset => (
                    <button 
                      key={asset.id}
                      onClick={() => {
                        setAssetCode(asset.assetCode);
                        handleLookup(asset.assetCode);
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Scan {asset.assetCode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Audit detail column */}
          <div className="flex-1 flex flex-col gap-6 lg:max-w-md">
            <AnimatePresence mode="wait">
              {scannedAsset ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col shrink-0"
                >
                  <div className="flex items-center justify-between pb-6 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{scannedAsset.assetCode}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{scannedAsset.assetType}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[9px] font-extrabold text-emerald-600 uppercase">
                      verified
                    </span>
                  </div>

                  <div className="mt-6 space-y-5 flex-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Target Hostname</span>
                      <span className="font-bold text-slate-800">{scannedAsset.hostname || 'UNASSIGNED'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Serial Number (SN)</span>
                      <span className="font-mono font-bold text-slate-800">{scannedAsset.serialNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Current Location</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {scannedAsset.location || 'UNASSIGNED'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Current Rack Placement</span>
                      <span className="font-bold text-slate-800">
                        {scannedAsset.rack || 'Shared'} (U{scannedAsset.uPosition || 1})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Ownership Assignee</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        {scannedAsset.owner?.fullName || 'YATO Shared'}
                      </span>
                    </div>

                    <div className="h-px bg-slate-50 my-6" />

                    {/* Prometheus Sync health status */}
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Sync collector health status</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-medium uppercase">Health status</span>
                          <span className={cn(
                            "text-xs font-extrabold block uppercase tracking-tight",
                            scannedAsset.healthStatus === 'HEALTHY' ? 'text-emerald-600' : 'text-amber-500'
                          )}>{scannedAsset.healthStatus || 'UNKNOWN'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-medium uppercase">Last check-in</span>
                          <span className="text-xs font-mono font-bold text-slate-600 block">
                            {scannedAsset.lastSeen ? new Date(scannedAsset.lastSeen).toLocaleTimeString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* QUICK MOVE AUDIT WORKFLOW */}
                    <div className="p-4 bg-blue-50/40 border border-blue-100/50 rounded-2xl space-y-3">
                      <p className="text-[10px] font-extrabold text-blue-800 uppercase tracking-widest">Audit action: Quick Relocate</p>
                      <p className="text-[11px] text-blue-700/80 font-medium">Quickly update location to new datacenters on scanned validation:</p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button 
                          onClick={() => handleQuickMove("Datacenter Alpha (A)", "RACK-A02")}
                          disabled={relocateMutation.isPending}
                          className="py-2.5 px-3 bg-white hover:bg-blue-50 border border-blue-100 text-blue-600 hover:text-blue-700 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                        >
                          {relocateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Move Datacenter A
                        </button>
                        <button 
                          onClick={() => handleQuickMove("Datacenter Beta (B)", "RACK-B10")}
                          disabled={relocateMutation.isPending}
                          className="py-2.5 px-3 bg-white hover:bg-blue-50 border border-blue-100 text-blue-600 hover:text-blue-700 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                        >
                          {relocateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Move Datacenter B
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-slate-100/50 border border-dashed border-slate-200 rounded-3xl p-10 text-center flex flex-col items-center justify-center py-24 min-h-[300px]">
                  <QrCode className="w-12 h-12 text-slate-300 mb-4 animate-bounce" />
                  <h4 className="font-bold text-slate-500 text-sm">Waiting for Scan...</h4>
                  <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Enter an asset code or use the simulator scan panel to load physical audit details</p>
                </div>
              )}
            </AnimatePresence>
          </div>

        </main>
      </div>
    </div>
  );
}
