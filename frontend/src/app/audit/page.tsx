"use client";
import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect } from "react";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { 
  History, 
  Search, 
  Download, 
  Calendar, 
  Loader2, 
  User as UserIcon,
  Globe,
  Terminal,
  Activity,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Skeleton, TableSkeleton } from "@/components/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { exportToCSV } from "@/lib/csvHelper";
import { Pagination } from "@/components/Pagination";
import { MobileNav } from "@/components/MobileNav";

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  user?: {
    email: string;
    fullName: string;
  };
}

export default function AuditPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showRangePanel, setShowRangePanel] = useState(false);
  const limit = 20;

  // Debounce search term to prevent excessive API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: response, isLoading } = useQuery({
    queryKey: ["audit-logs", page, startDate, endDate, debouncedSearch],
    queryFn: async () => {
      let url = `/audit/?page=${page}&limit=${limit}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const logs = response?.data || [];
  const totalPages = response?.totalPages || 1;
  const totalItems = response?.total || 0;

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Format";
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleExport = () => {
    if (!logs || logs.length === 0) return;
    
    const exportData = logs.map((log: any) => ({
      'Timestamp': formatDate(log.timestamp),
      'Actor': log.user?.fullName || 'System',
      'Action': log.action,
      'Resource': log.resource,
      'Resource ID': log.resourceId || 'global',
      'IP Address': log.ipAddress || '::1',
      'User Agent': log.userAgent
    }));

    exportToCSV(exportData, 'yato_audit_logs');
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar p-8 flex-1">
          <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <PageHeader title="Log Activity" subtitle="Immutable system activity logs" />
            </div>
            <button 
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95 self-start md:self-auto"
            >
              <Download className="w-4 h-4" /> Export records
            </button>
          </header>

          <div className="flex flex-col gap-4 mb-8">
            <div className="flex gap-4">
              <div className="relative flex-1 group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input 
                  type="text" 
                  className="input-field pl-11 py-3 w-full bg-white" 
                  placeholder="Filter by actor, action or IP address..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                className={`btn-secondary flex items-center gap-2 bg-white ${(startDate || endDate) ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`} 
                onClick={() => setShowRangePanel(!showRangePanel)}
              >
                <Calendar className="w-4 h-4" /> 
                {(startDate || endDate) ? 'Filter Active' : 'Range'}
              </button>
              {(startDate || endDate) && (
                <button 
                  className="btn-secondary bg-white text-rose-500 border-rose-100 hover:bg-rose-50" 
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                >
                  Clear
                </button>
              )}
            </div>

            <AnimatePresence>
              {showRangePanel && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap gap-6 items-end shadow-sm">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Start Date</label>
                      <input 
                        type="date" 
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all shadow-sm"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">End Date</label>
                      <input 
                        type="date" 
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all shadow-sm"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed max-w-[200px]">
                      Filter records by a specific time period. The ledger will automatically refresh.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="glass-card !p-0 overflow-hidden ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/20 mb-6 bg-white">
            {isLoading ? (
              <div className="p-8">
                <TableSkeleton rows={8} cols={5} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timestamp</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actor</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resource Path</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {logs.map((log: any) => (
                      <motion.tr 
                        key={log.id} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="text-[11px] font-mono font-bold text-slate-500 whitespace-nowrap">
                            {formatDate(log.timestamp)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-[12px] font-bold text-slate-700">{log.user?.fullName || "System"}</p>
                              <p className="text-[10px] font-semibold text-slate-400">{log.user?.email || "internal@system"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`badge ${
                            log.action.includes('FAIL') || log.action.includes('LOCK') || log.action.includes('ERROR') ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            log.action.includes('CREATE') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            log.action.includes('DELETE') ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            log.action.includes('LOGIN') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{log.resource}</span>
                            <span className="text-[11px] font-mono font-bold text-blue-600 truncate max-w-[120px]">{log.resourceId || "global"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Globe className="w-3 h-3 text-slate-300" />
                            <span className="text-[11px] font-bold text-slate-500">{log.ipAddress || "::1"}</span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6">
            <Pagination 
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              itemsPerPage={limit}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
