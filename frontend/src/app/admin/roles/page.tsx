"use client";
import { PageHeader } from "@/components/PageHeader";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { 
  Shield, 
  Plus, 
  Search, 
  Check, 
  X,
  Trash2,
  Loader2,
  Edit3,
  ShieldAlert,
  ChevronRight,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";


interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  _count?: {
    users: number;
  };
}

export default function RolesManagementPage() {
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: isProfileLoading } = useIsAdmin();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null as Role | null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null as string | null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[]
  });

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await api.get("/roles");
      return response.data;
    },
  });

  const { data: availablePermissions } = useQuery({
    queryKey: ["available-permissions"],
    queryFn: async () => {
      const response = await api.get("/roles/permissions");
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/roles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setIsDeleteModalOpen(false);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", permissions: [] });
    setIsEditMode(false);
    setSelectedRole(null);
  };

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode && selectedRole) {
      updateMutation.mutate({ id: selectedRole.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const togglePermission = (perm: string) => {
    if (formData.permissions.includes(perm)) {
      setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== perm) });
    } else {
      setFormData({ ...formData, permissions: [...formData.permissions, perm] });
    }
  };

  const filteredRoles = roles?.filter(r => 
    (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  if (isProfileLoading || isLoading) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Access Policies...</p>
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
          <p className="text-sm text-slate-400">You must hold administrative privileges to access Access Control.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar p-8 flex-1">
          <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <PageHeader title="Access Control" subtitle="Role-based access control and policies" />
            </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="btn-primary flex items-center gap-2.5"
          >
            <Plus className="w-5 h-5" />
            <span>Create Custom Role</span>
          </button>
        </header>

        <div className="flex gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              className="input-field pl-11 w-full" 
              placeholder="Search roles by name or description..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {isLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="glass-card animate-pulse bg-slate-50 h-64" />
              ))
            ) : (
              filteredRoles?.map((role) => (
                <motion.div 
                  key={role.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card group hover:border-blue-400 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                        <Shield className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleEdit(role)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100 shadow-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setRoleToDelete(role.id); setIsDeleteModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100 shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-slate-900 mb-2 text-base tracking-tight">{role.name}</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed h-10 line-clamp-2 font-bold uppercase tracking-tight">{role.description || "No description provided."}</p>
                    
                    <div className="mt-8 flex items-center gap-6">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Users</span>
                        <span className="text-sm font-bold text-slate-700">{role._count?.users || 0}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Permissions</span>
                        <span className="text-sm font-bold text-blue-600">{role.permissions.length}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between group-hover:border-blue-100 transition-colors">
                    <div className="flex -space-x-2">
                      {role.permissions.slice(0, 4).map((p, idx) => (
                        <div key={p} className="w-6 h-6 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm" title={p}>
                          <Lock className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      ))}
                      {role.permissions.length > 4 && (
                        <div className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                          +{role.permissions.length - 4}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm overflow-y-auto py-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/20">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">{isEditMode ? "Modify Privileges" : "Define Policy"}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configure access control levels</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs">Role Identity Name</label>
                    <input 
                      type="text" 
                      required
                      className="input-field w-full py-2.5 text-sm" 
                      placeholder="e.g. Compliance Officer"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      disabled={isEditMode && (formData.name === 'ADMIN' || formData.name === 'USER')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs">Description & Purpose</label>
                    <textarea 
                      rows={2}
                      className="input-field w-full py-2.5 text-sm resize-none" 
                      placeholder="What is the scope of this role?"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="mb-0 font-bold text-slate-700 text-xs">Capability Assignment</label>
                      <span className="text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                        {formData.permissions.length} Active
                      </span>
                    </div>
                    
                    <div className="space-y-6 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                      {[
                        { 
                          group: "Main & Dashboard", 
                          perms: ["VIEW_DASHBOARD"] 
                        },
                        { 
                          group: "Support Ticketing", 
                          perms: ["VIEW_SUPPORT_TICKETS", "MANAGE_SUPPORT_TICKETS", "APPROVE_REQUESTS"] 
                        },
                        { 
                          group: "Infrastructure (VM)", 
                          perms: ["VIEW_VM_INVENTORY", "PROVISION_VM", "MANAGE_VM_INVENTORY"] 
                        },
                        { 
                          group: "Infrastructure (Service)", 
                          perms: ["VIEW_SERVICE_INVENTORY", "PROVISION_SERVICE", "MANAGE_SERVICE_INVENTORY"] 
                        },
                        { 
                          group: "Security & Secrets", 
                          perms: ["VIEW_CREDENTIALS", "MANAGE_CREDENTIALS"] 
                        },
                        { 
                          group: "Asset Registry", 
                          perms: ["VIEW_ASSETS", "MANAGE_ASSETS"] 
                        },
                        { 
                          group: "Tasks Tracker", 
                          perms: ["VIEW_TASKS", "MANAGE_TASKS"] 
                        },
                        { 
                          group: "File Manager & Storage", 
                          perms: ["VIEW_FILES", "MANAGE_FILES"] 
                        },
                        { 
                          group: "Human Resource Management", 
                          perms: [
                            "VIEW_HRM", 
                            "MANAGE_HRM", 
                            "VIEW_HRM_ADMIN_PANEL", 
                            "MANAGE_HRM_ATTENDANCE", 
                            "MANAGE_HRM_LEAVES", 
                            "MANAGE_HRM_DIVISIONS", 
                            "MANAGE_HRM_SCHEDULER", 
                            "MANAGE_HRM_ADJUSTMENTS"
                          ] 
                        },
                        { 
                          group: "Notes & Schedule", 
                          perms: ["VIEW_NOTES", "MANAGE_NOTES"] 
                        },
                        { 
                          group: "PMO Calendar & Timeline", 
                          perms: ["VIEW_PMO_CALENDAR", "MANAGE_PMO_CALENDAR"] 
                        },
                        { 
                          group: "Integrations & Broadcast", 
                          perms: ["VIEW_INTEGRATIONS", "VIEW_BROADCAST"] 
                        },
                        { 
                          group: "System & Governance", 
                          perms: ["VIEW_AUDIT_LOGS", "VIEW_SYSTEM_STATUS", "MANAGE_USERS", "MANAGE_ROLES", "MANAGE_CONFIG"] 
                        }
                      ].map(section => (
                        <div key={section.group} className="space-y-2.5">
                          <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="w-6 h-px bg-slate-100" />
                            {section.group}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             {section.perms.map(perm => (
                              <button
                                key={perm}
                                type="button"
                                onClick={() => togglePermission(perm)}
                                className={cn(
                                  "flex flex-col gap-1 px-3 py-2.5 rounded-xl border transition-all text-left group/btn",
                                  formData.permissions.includes(perm) 
                                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/10" 
                                    : "bg-white border-slate-100 text-slate-500 hover:border-blue-200"
                                )}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className={cn(
                                    "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                                    formData.permissions.includes(perm)
                                      ? "bg-white/20 text-white"
                                      : perm.startsWith('VIEW')
                                        ? "bg-slate-100 text-slate-500"
                                        : perm.startsWith('PROVISION')
                                          ? "bg-indigo-50 text-indigo-600"
                                          : "bg-emerald-50 text-emerald-600"
                                  )}>
                                    {perm.split('_')[0]}
                                  </span>
                                  {formData.permissions.includes(perm) 
                                    ? <Check className="w-3.5 h-3.5" /> 
                                    : <Plus className="w-3.5 h-3.5 opacity-0 group-hover/btn:opacity-30" />
                                  }
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                  {perm.split('_').slice(1).join(' ')}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn-primary w-full py-4 flex items-center justify-center gap-3"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
                    <span>{isEditMode ? "Update Policy" : "Authorize Role"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => roleToDelete && deleteMutation.mutate(roleToDelete)}
        title="Destroy Policy?"
        message="Warning: Removing this role will immediately revoke access for all associated users. This action is irreversible."
        confirmText="Yes, Destroy Role"
        isLoading={deleteMutation.isPending}
      />
      </div>
    </div>
  );
}
