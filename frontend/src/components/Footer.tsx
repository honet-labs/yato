"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBranding } from "@/context/branding-context";

export function Footer() {
  const { appFooter } = useBranding();
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState(null as Element | null);

  useEffect(() => {
    setMounted(true);
    // Find the main scrollable container on the page
    const mainContainer = document.querySelector("main.page-container");
    setContainer(mainContainer);
  }, []);

  if (!mounted) return null;

  const footerContent = (
    <footer className="w-full py-4 text-center text-[10px] text-slate-400 font-extrabold tracking-wide border-t border-slate-100 flex items-center justify-center shrink-0 mt-auto">
      {appFooter || "© 2026 YATO. All rights reserved."}
    </footer>
  );

  // If the page has a main.page-container, render the footer inside it at the bottom.
  // Otherwise, fallback to rendering it in-place.
  if (container) {
    return createPortal(footerContent, container);
  }

  return footerContent;
}
