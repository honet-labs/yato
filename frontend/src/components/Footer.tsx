"use client";

import { useBranding } from "@/context/branding-context";

export function Footer() {
  const { appFooter } = useBranding();
  return (
    <footer className="w-full mt-auto py-6 border-t border-slate-200/40 text-center text-[11px] text-slate-400 font-bold tracking-wide">
      {appFooter || "© 2026 YATO. All rights reserved."}
    </footer>
  );
}
