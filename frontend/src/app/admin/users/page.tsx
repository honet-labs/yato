"use client";
import { PageHeader } from "@/components/PageHeader";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Pagination } from "@/components/Pagination";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  ShieldAlert, 
  Loader2, 
  X,
  Lock,
  User as UserIcon,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Phone,
  AtSign,
  ChevronRight,
  Send,
  Search,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBranding } from "@/context/branding-context";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

interface UserData {
  id: string;
  email: string;
  username?: string;
  fullName: string;
  role: string;
  phoneNumber?: string;
  personalEmail?: string;
  telegramId?: string;
  isMfaEnabled: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { formatDate } = useBranding();
  const queryClient = useQueryClient();
  const { showToast } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    fullName: "",
    phoneNumber: "",
    personalEmail: "",
    telegramId: "",
    roleIds: [] as string[],
    isMfaEnabled: false,
  });
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const response = await api.get("/users/");
      return response.data;
    },
  });

  const { data: roles } = useQuery<any[]>({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const response = await api.get("/roles");
      return response.data;
    },
  });

  const filteredUsers = users?.filter(user => 
    user.fullName.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.username?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const addMutation = useMutation({
    mutationFn: (newUser: any) => api.post("/auth/register/", newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ email: "", username: "", password: "", fullName: "", phoneNumber: "", personalEmail: "", telegramId: "", roleIds: [], isMfaEnabled: false });
      showToast("User berhasil didaftarkan.", "success");
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || "Gagal mendaftarkan user.", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ email: "", username: "", password: "", fullName: "", phoneNumber: "", personalEmail: "", telegramId: "", roleIds: [], isMfaEnabled: false });
      showToast("User berhasil diupdate.", "success");
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || "Gagal mengupdate user.", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
  
  const resetMfaMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}`, { isMfaEnabled: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showToast("MFA berhasil dinonaktifkan.", "success");
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || "Gagal menonaktifkan MFA.", "error");
    }
  });

  const handleResetMfa = (id: string, fullName: string) => {
    if (confirm(`Apakah Anda yakin ingin menonaktifkan/reset MFA untuk ${fullName}?`)) {
      resetMfaMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      username: user.username || "",
      password: "", // Leave blank for no change
      fullName: user.fullName,
      phoneNumber: user.phoneNumber || "",
      personalEmail: user.personalEmail || "",
      telegramId: user.telegramId || "",
      roleIds: user.roles?.map((r: any) => r.role.id) || [],
      isMfaEnabled: user.isMfaEnabled,
    });
    setIsModalOpen(true);
  };

  const getStrength = (pass: string) => {
    if (!pass) return 0;
    let s = 0;
    if (pass.length > 8) s += 40;
    if (/[A-Z]/.test(pass)) s += 30;
    if (/[0-9]/.test(pass)) s += 30;
    return s;
  };

  return (
    <div className="flex min-h-screen bg-background font-sans text-[13px]">
      <MobileNav />
      <Sidebar />
      
      <main className="page-container">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <PageHeader title="User Management" subtitle="Comprehensive user profiles and contact data" />
          </div>
          <div className="flex items-center gap-4 md:ml-auto">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text" 
                className="bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm w-64 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all" 
                placeholder="Search user..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setEditingUser(null);
                setFormData({ email: "", username: "", password: "", fullName: "", phoneNumber: "", personalEmail: "", telegramId: "", roleIds: [] });
                setIsModalOpen(true);
              }}
              className="btn-primary flex items-center gap-2.5 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </header>

        <div className="glass-card !p-0 overflow-hidden ring-1 ring-slate-200/60">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p className="text-xs font-bold uppercase tracking-widest">Accessing Users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Identity & Contact</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Secondary Contact</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Assigned Roles</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Security</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Onboarded & Last Access</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedUsers?.map((user: any) => (
                    <motion.tr 
                      key={user.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 text-sm">
                            {user.fullName ? user.fullName.charAt(0) : user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 tracking-tight">{user.fullName || "User Identity"}</p>
                            <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5 mt-0.5 uppercase tracking-tighter">
                              <Mail className="w-3.5 h-3.5" /> {user.email} • @{user.username || user.email.split('@')[0]}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                            <Phone className="w-3.5 h-3.5 text-slate-500" /> {user.phoneNumber || "N/A"}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                            <AtSign className="w-3.5 h-3.5 text-slate-500" /> {user.personalEmail || "N/A"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.map((ur: any) => (
                            <span key={ur.role.id} className="badge bg-indigo-50 text-indigo-600 border-indigo-100 uppercase tracking-wider text-[9px] font-bold">
                              {ur.role.name}
                            </span>
                          ))}
                          {(!user.roles || user.roles.length === 0) && (
                            <span className="text-[10px] italic text-slate-600 font-bold uppercase tracking-widest">No Roles</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "badge",
                          user.isMfaEnabled ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                        )}>
                          {user.isMfaEnabled ? <Shield className="w-3 h-3 mr-1.5" /> : <ShieldAlert className="w-3 h-3 mr-1.5" />}
                          {user.isMfaEnabled ? 'MFA SECURE' : 'MFA PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-slate-600 uppercase">
                            {formatDate(user.createdAt, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {user.lastLogin ? (
                            <span className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {formatDate(user.lastLogin, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              Never Logged In
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {user.isMfaEnabled && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleResetMfa(user.id, user.fullName); }}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm"
                              title="Disable & Reset MFA"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEdit(user); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if(confirm('Revoke access for this user?')) deleteMutation.mutate(user.id);
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-300 ml-2" />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/20">
                    <UserPlus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">{editingUser ? 'Update Identity' : 'Provision Identity'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{editingUser ? 'Modify user credentials' : 'Enroll new platform user'}</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5 col-span-2">
                    <label>Full Legal Name</label>
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        required
                        className="input-field pl-12 w-full py-3.5"
                        placeholder="e.g. John Doe"
                        autoComplete="name"
                        value={formData.fullName}
                        onChange={e => setFormData({...formData, fullName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label>Platform Username</label>
                    <div className="relative group">
                      <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        className="input-field pl-12 w-full py-3.5"
                        placeholder="johndoe (used for @mentions)"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label>Work Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="email" 
                        required
                        className="input-field pl-12 w-full py-3.5"
                        placeholder="user@honet.web.id"
                        autoComplete="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label>Personal Email</label>
                    <div className="relative group">
                      <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="email" 
                        className="input-field pl-12 w-full py-3.5"
                        placeholder="personal@email.com"
                        value={formData.personalEmail}
                        onChange={e => setFormData({...formData, personalEmail: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label>Contact Number</label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="tel" 
                        className="input-field pl-12 w-full py-3.5"
                        placeholder="+62 812..."
                        value={formData.phoneNumber}
                        onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label>Telegram Chat ID</label>
                    <div className="relative group">
                      <Send className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text" 
                        className="input-field pl-12 w-full py-3.5"
                        placeholder="e.g. 12345678"
                        value={formData.telegramId}
                        onChange={e => setFormData({...formData, telegramId: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label>{editingUser ? 'New Access Key (Optional)' : 'Initial Access Key'}</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required={!editingUser}
                        className="input-field pl-12 pr-11 w-full font-mono py-3.5"
                        placeholder={editingUser ? "Leave blank to keep current" : "••••••••"}
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {editingUser && (
                    <div className="space-y-1.5 flex flex-col justify-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Multi-Factor Authentication</label>
                      <label className={cn(
                        "flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100/50 hover:border-slate-200 transition-all mt-1",
                        formData.isMfaEnabled && "border-emerald-200 bg-emerald-50/10 hover:bg-emerald-50/20"
                      )}>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 text-emerald-600 border-slate-200 rounded focus:ring-emerald-500 cursor-pointer"
                          checked={formData.isMfaEnabled}
                          onChange={(e) => setFormData({ ...formData, isMfaEnabled: e.target.checked })}
                        />
                        <div>
                          <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">MFA Enabled</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Disable to clear the MFA/2FA token secret</p>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Role Assignment Checkbox Grid */}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role Assignment</label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      {roles?.map((role: any) => {
                        const isChecked = formData.roleIds.includes(role.id);
                        return (
                          <label 
                            key={role.id}
                            className={cn(
                              "flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100/50 hover:border-slate-200 transition-all",
                              isChecked && "border-blue-200 bg-blue-50/10 hover:bg-blue-50/20"
                            )}
                          >
                            <input 
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 border-slate-200 rounded focus:ring-blue-500 cursor-pointer mt-0.5"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, roleIds: [...formData.roleIds, role.id] });
                                } else {
                                  setFormData({ ...formData, roleIds: formData.roleIds.filter(id => id !== role.id) });
                                }
                              }}
                            />
                            <div className="overflow-hidden">
                              <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wide truncate">{role.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter truncate max-w-[180px]" title={role.description}>{role.description || "No description"}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      getStrength(formData.password) <= 40 ? 'bg-rose-500' : 
                      getStrength(formData.password) <= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${getStrength(formData.password)}%` }}
                  />
                </div>
                
                <div className="pt-6 border-t border-slate-50">
                  <button 
                    type="submit" 
                    disabled={addMutation.isPending || updateMutation.isPending}
                    className="btn-primary w-full py-4 flex items-center justify-center gap-3"
                  >
                    {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                    <span>{editingUser ? 'Update Identity' : 'Authorize Identity'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
