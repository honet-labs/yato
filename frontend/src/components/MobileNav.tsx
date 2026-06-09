"use client";

import { useState } from "react";
import { Menu, X, Box } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { useBranding } from "@/context/branding-context";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { appName, appLogo } = useBranding();

  return (
    <div className="lg:hidden">
      {/* Mobile Header Bar */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white flex items-center justify-between px-6 z-[60] border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-2.5">
          {appLogo ? (
            <img src={appLogo} alt="Logo" className="w-8 h-8 object-contain rounded-lg shadow-sm" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Box className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-bold text-slate-900 tracking-tight">{appName}</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[70]"
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 z-[80] shadow-2xl"
            >
              <Sidebar isMobile onNavItemClick={() => setIsOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for content */}
      <div className="h-16" />
    </div>
  );
}
