"use client";

import { useBranding } from "@/context/branding-context";

export function Footer() {
  const { appFooter } = useBranding();
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-10 bg-white border-t border-slate-200/50 text-center flex items-center justify-center text-[10px] text-slate-400 font-extrabold tracking-wide z-[59] shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
      {appFooter || "© 2026 YATO. All rights reserved."}
    </footer>
  );
}
