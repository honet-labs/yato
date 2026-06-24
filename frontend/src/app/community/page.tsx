"use client";

import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useState } from "react";
import { 
  Search, 
  ShieldCheck, 
  HelpCircle, 
  ArrowRight, 
  Lock, 
  Users, 
  FileText,
  Bookmark,
  CheckCircle2,
  BookOpen
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

interface MappingItem {
  menu: string;
  category: string;
  perm: string;
  desc: string;
  descEn: string;
}

const mappingData: MappingItem[] = [
  { 
    menu: "Dashboard", 
    category: "Main Menu", 
    perm: "VIEW_DASHBOARD", 
    desc: "Melihat halaman utama statistik & dashboard", 
    descEn: "View the main dashboard statistics and widgets" 
  },
  { 
    menu: "Support Tickets", 
    category: "Main Menu", 
    perm: "VIEW_SUPPORT_TICKETS", 
    desc: "Mengakses halaman tiket bantuan dan membuat tiket", 
    descEn: "Access the support ticketing dashboard and raise issues" 
  },
  { 
    menu: "File Manager", 
    category: "Main Menu", 
    perm: "VIEW_FILES", 
    desc: "Membuka repositori file & dokumen", 
    descEn: "Open the file manager and document storage space" 
  },
  { 
    menu: "Tasks Tracker", 
    category: "Productivity", 
    perm: "VIEW_TASKS", 
    desc: "Membuka panel tugas (Project/Tasks)", 
    descEn: "Open the project and task board tracking panel" 
  },
  { 
    menu: "Notes & Schedule", 
    category: "Productivity", 
    perm: "VIEW_NOTES", 
    desc: "Mengakses catatan pribadi & jadwal kalender", 
    descEn: "Access personal notes, schedules, and integrated reminders" 
  },
  { 
    menu: "PMO Calendar", 
    category: "Productivity", 
    perm: "VIEW_PMO_CALENDAR", 
    desc: "Mengakses kalender kerja & linimasa PMO", 
    descEn: "Access the workspace project calendar and milestones timeline" 
  },
  { 
    menu: "Attendance", 
    category: "Attendance & Timesheet", 
    perm: "VIEW_HRM", 
    desc: "Mengakses fitur presensi kehadiran mandiri", 
    descEn: "Access self-service employee attendance check-in/out" 
  },
  { 
    menu: "Leave Hub", 
    category: "Attendance & Timesheet", 
    perm: "VIEW_HRM", 
    desc: "Mengajukan cuti & melihat sisa jatah cuti", 
    descEn: "Apply for leaves and view remaining leave balance quota" 
  },
  { 
    menu: "Management Admin Panel", 
    category: "Management Admin", 
    perm: "VIEW_HRM_ADMIN_PANEL", 
    desc: "Mengelola rekap absen & cuti seluruh karyawan", 
    descEn: "Supervise attendance logs and approve leaves for all employees" 
  },
  { 
    menu: "Division Mappings", 
    category: "Management Admin", 
    perm: "MANAGE_HRM_DIVISIONS", 
    desc: "Mengatur pemetaan divisi perusahaan", 
    descEn: "Configure company division structures and mappings" 
  },
  { 
    menu: "Shift Scheduler", 
    category: "Management Admin", 
    perm: "MANAGE_HRM_SCHEDULER", 
    desc: "Mengatur penjadwalan shift kerja divisi", 
    descEn: "Schedule work shifts and rosters for different divisions" 
  },
  { 
    menu: "Attendance Adjust", 
    category: "Management Admin", 
    perm: "MANAGE_HRM_ADJUSTMENTS", 
    desc: "Melakukan koreksi / penyesuaian data absen", 
    descEn: "Perform manual adjustments and corrections on attendance logs" 
  },
  { 
    menu: "VM Instances", 
    category: "Infrastructure", 
    perm: "VIEW_VM_INVENTORY", 
    desc: "Melihat inventaris VM yang sedang aktif", 
    descEn: "View active virtual machine instances and inventory details" 
  },
  { 
    menu: "Service Assets", 
    category: "Infrastructure", 
    perm: "VIEW_SERVICE_INVENTORY", 
    desc: "Melihat inventaris aplikasi / layanan aktif", 
    descEn: "View active microservices and application assets" 
  },
  { 
    menu: "Credential Vault", 
    category: "Infrastructure", 
    perm: "VIEW_CREDENTIALS", 
    desc: "Mengakses brankas penyimpanan kredensial & password", 
    descEn: "Access the credentials vault and secure secrets store" 
  },
  { 
    menu: "VM Inventory", 
    category: "Infra Management", 
    perm: "MANAGE_VM_INVENTORY", 
    desc: "Menambah, mengedit, atau menghapus VM", 
    descEn: "Administer VM assets (create, update, or remove entries)" 
  },
  { 
    menu: "Service Assets Inventory", 
    category: "Infra Management", 
    perm: "MANAGE_SERVICE_INVENTORY", 
    desc: "Menambah, mengedit, atau menghapus layanan", 
    descEn: "Administer service assets (create, update, or remove entries)" 
  },
  { 
    menu: "Asset Registry", 
    category: "Infra Management", 
    perm: "VIEW_ASSETS", 
    desc: "Mengakses register aset fisik & cetak QR Code", 
    descEn: "Access physical hardware registry and print QR labels" 
  },
  { 
    menu: "System Status", 
    category: "System Control", 
    perm: "VIEW_SYSTEM_STATUS", 
    desc: "Memantau penggunaan resource server (CPU/RAM)", 
    descEn: "Monitor system health, CPU load, and memory usage" 
  },
  { 
    menu: "Log Activity", 
    category: "System Control", 
    perm: "VIEW_AUDIT_LOGS", 
    desc: "Melihat log aktivitas audit sistem", 
    descEn: "Access overall audit logs of administrative actions" 
  },
  { 
    menu: "User Management", 
    category: "System Control", 
    perm: "MANAGE_USERS", 
    desc: "Menambah/mengedit akun user & menetapkan Role", 
    descEn: "Manage user credentials, profiles, and assign roles" 
  },
  { 
    menu: "Broadcast Message", 
    category: "System Control", 
    perm: "VIEW_BROADCAST", 
    desc: "Mengirim pesan siaran massal (Email/WA/Telegram)", 
    descEn: "Send out broadcast announcements via SMTP, WA, or Telegram" 
  },
  { 
    menu: "Access Control", 
    category: "System Control", 
    perm: "MANAGE_ROLES", 
    desc: "Mengelola Role & Izin (Role Management)", 
    descEn: "Configure role definitions and select capability lists" 
  },
  { 
    menu: "Platform Settings", 
    category: "System Control", 
    perm: "MANAGE_CONFIG", 
    desc: "Mengubah setelan sistem, branding, & SMTP", 
    descEn: "Change platform-wide variables, branding icons, and SMTP settings" 
  },
  { 
    menu: "Integration Hub", 
    category: "System Control", 
    perm: "VIEW_INTEGRATIONS", 
    desc: "Menghubungkan API pihak ketiga", 
    descEn: "Manage integration webhooks and third-party API configurations" 
  },
];

export default function CommunityPage() {
  const { lang, t } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Main Menu", "Productivity", "Attendance & Timesheet", "Management Admin", "Infrastructure", "Infra Management", "System Control"];

  const filteredData = mappingData.filter(item => {
    const matchesSearch = 
      item.menu.toLowerCase().includes(search.toLowerCase()) ||
      item.perm.toLowerCase().includes(search.toLowerCase()) ||
      item.desc.toLowerCase().includes(search.toLowerCase()) ||
      item.descEn.toLowerCase().includes(search.toLowerCase());
      
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar p-8 flex-1">
          <header className="mb-8">
            <PageHeader 
              title={lang === "ID" ? "Pusat Komunitas & Dokumentasi" : "Community & Docs Hub"} 
              subtitle={lang === "ID" ? "Panduan pemetaan hak akses menu dan bantuan penggunaan platform" : "Reference guide for menu permissions mapping and platform help"} 
            />
          </header>

          {/* Quick FAQ / Guide Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="glass-card flex gap-4 hover:border-blue-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 text-sm tracking-tight">
                  {lang === "ID" ? "Bagaimana Menu Bekerja?" : "How do menus work?"}
                </h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mb-2">
                  {lang === "ID" ? "Sistem Otentikasi Dinamis" : "Dynamic Authentication System"}
                </p>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  {lang === "ID" 
                    ? "Setiap item menu di sidebar kiri dikunci menggunakan Permission Key tertentu. Jika role user tidak memilikinya, menu tersebut otomatis disembunyikan."
                    : "Each sidebar menu item is protected by a specific Permission Key. If the user's role lacks this key, the menu is completely hidden."}
                </p>
              </div>
            </div>

            <div className="glass-card flex gap-4 hover:border-blue-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 text-sm tracking-tight">
                  {lang === "ID" ? "Cara Membuka Akses Menu" : "How to unlock menu access"}
                </h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mb-2">
                  {lang === "ID" ? "Panduan 3-Langkah Admin" : "3-Step Admin Guide"}
                </p>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  {lang === "ID" 
                    ? "1. Buat/edit Role di Access Control dan centang permission key menu. 2. Buka User Management dan edit user terkait. 3. Hubungkan Role tersebut ke user."
                    : "1. Create/edit Role in Access Control and check the menu permission. 2. Open User Management and edit the target user. 3. Assign the Role to the user."}
                </p>
              </div>
            </div>

            <div className="glass-card flex gap-4 hover:border-blue-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <HelpCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 text-sm tracking-tight">
                  {lang === "ID" ? "Menu Tidak Muncul?" : "Menu still not appearing?"}
                </h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mb-2">
                  {lang === "ID" ? "Pemecahan Masalah" : "Troubleshooting Tips"}
                </p>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  {lang === "ID" 
                    ? "Pastikan user melakukan Logout terlebih dahulu lalu Login kembali agar sesi/token JWT baru yang membawa hak akses baru dimuat ke browser."
                    : "Ensure the user signs out and signs back in so that the browser loads a fresh JWT token session containing the updated permissions list."}
                </p>
              </div>
            </div>
          </div>

          {/* Directory Panel */}
          <div className="glass-card ring-1 ring-slate-200/60 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {lang === "ID" ? "Direktori Izin Akses Menu" : "Menu Permission Directory"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === "ID" ? "Gunakan tabel pencarian ini untuk mencocokkan nama menu dengan kunci izin di Access Control" : "Use this search table to map sidebar menu labels to Access Control keys"}
                </p>
              </div>

              <div className="relative group min-w-[280px]">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input 
                  type="text" 
                  className="bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm w-full focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all" 
                  placeholder={lang === "ID" ? "Cari menu atau permission key..." : "Search menu name or permission..."} 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all",
                    selectedCategory === cat
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100/60 text-slate-500 hover:bg-slate-150 hover:text-slate-700"
                  )}
                >
                  {cat === "All" ? (lang === "ID" ? "SEMUA" : "ALL") : cat}
                </button>
              ))}
            </div>

            {/* Directory Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-1/4">
                      {lang === "ID" ? "Nama Menu & Kategori" : "Menu & Category"}
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-1/3">
                      {lang === "ID" ? "Permission Key di Access Control" : "Permission Key in Access Control"}
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {lang === "ID" ? "Deskripsi Fungsional" : "Functional Scope"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Lock className="w-6 h-6 text-slate-200" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest">
                          {lang === "ID" ? "Izin tidak ditemukan" : "No permissions matched"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-900">{t(item.menu)}</span>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-bold bg-blue-50/60 text-blue-600 border border-blue-100/60 px-2.5 py-1 rounded-lg">
                              {item.perm}
                            </code>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[13px] text-slate-600 leading-relaxed">
                            {lang === "ID" ? item.desc : item.descEn}
                          </p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
