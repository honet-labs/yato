"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

interface AccessDeniedProps {
  pageName: string;
}

export function AccessDenied({ pageName }: AccessDeniedProps) {
  return (
    <div className="flex min-h-screen bg-white items-center justify-center p-6">
      <div className="text-center space-y-5 max-w-sm">
        <div className="w-20 h-20 bg-rose-50 rounded-full border border-rose-200 flex items-center justify-center mx-auto mb-6 text-rose-500">
          <Lock className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Access Denied</h2>
        <p className="text-sm text-slate-400">You must hold administrative privileges to access {pageName}.</p>
        <div className="pt-2">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
