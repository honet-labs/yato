"use client";

import { PageHeader } from "@/components/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Pagination } from "@/components/Pagination";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Trash2, 
  CheckCheck,
  Loader2,
  Calendar
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate, getRelativeLink } from "@/lib/utils";

interface YatoNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  link?: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: response, isLoading } = useQuery({
    queryKey: ["notifications", page],
    queryFn: async () => {
      const res = await api.get(`/notifications?page=${page}&limit=${limit}`);
      return res.data;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const notifications = response?.data || [];
  const totalPages = response?.totalPages || 1;
  const totalCount = response?.totalCount || 0;

  return (
    <div className="flex min-h-screen bg-white text-slate-600">
      <MobileNav />
      <Sidebar />
      
      <main className="page-container">
        <header className="mb-10 flex flex-col md:items-center md:flex-row justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <PageHeader title="Notifications" subtitle="Stay updated with system events and request status" />
            </div>
          </div>
          
          <div className="flex items-center gap-3 ml-auto">
            <button 
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending || notifications.length === 0}
              className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          </div>
        </header>
 
        <div className="max-w-4xl space-y-4 mb-8">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse" />
            ))
          ) : notifications.length === 0 ? (
            <div className="py-24 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4 border border-slate-100">
                <Bell className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-400 text-[13px] font-bold uppercase tracking-widest">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((note: YatoNotification) => {
                const targetLink = getRelativeLink(note.link);

                return (
                  <motion.div 
                    key={note.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      if (!note.isRead) markAsReadMutation.mutate(note.id);
                      if (targetLink) router.push(targetLink);
                    }}
                    className={cn(
                      "group flex gap-5 p-6 rounded-2xl transition-all border relative cursor-pointer",
                      !note.isRead 
                        ? "bg-white border-blue-100 shadow-lg shadow-blue-600/5" 
                        : "bg-slate-50/50 border-slate-100 opacity-75 grayscale-[0.5]"
                    )}
                  >
                  {!note.isRead && (
                    <div className="absolute top-6 left-0 w-1 h-12 bg-blue-600 rounded-r-full" />
                  )}

                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                    note.type === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    note.type === 'WARNING' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    'bg-blue-50 text-blue-600 border-blue-100'
                  )}>
                    {note.type === 'SUCCESS' ? <CheckCircle2 className="w-6 h-6" /> :
                     note.type === 'WARNING' ? <AlertCircle className="w-6 h-6" /> :
                     <Info className="w-6 h-6" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-4">
                      <h4 className={cn(
                        "font-bold text-[15px] truncate",
                        !note.isRead ? "text-slate-900" : "text-slate-600"
                      )}>{note.title}</h4>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-tight shrink-0">
                        <Calendar className="w-3 h-3" />
                        {formatDate(note.createdAt)}
                      </div>
                    </div>
                    <p className="text-[14px] text-slate-500 leading-relaxed font-medium line-clamp-4 break-all" dangerouslySetInnerHTML={{ __html: note.message }} />
                    
                    {note.link && (
                      <div className="mt-3">
                        <a 
                          href={targetLink || note.link} 
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Details
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
            </div>
          )}
        </div>

        <Pagination 
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalCount}
          itemsPerPage={limit}
        />
      </main>
    </div>
  );
}
