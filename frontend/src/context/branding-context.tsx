"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";

interface BrandingContextType {
  appName: string;
  appLogo: string;
  appTitle: string;
  appFavicon: string;
  appFooter: string;
  appTimezone: string;
  isLoading: boolean;
  refreshBranding: () => Promise<void>;
  formatDate: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [appName, setAppName] = useState("YATO");
  const [appLogo, setAppLogo] = useState("");
  const [appTitle, setAppTitle] = useState("YATO | Infrastructure Platform");
  const [appFavicon, setAppFavicon] = useState("");
  const [appFooter, setAppFooter] = useState("© 2026 YATO. All rights reserved.");
  const [appTimezone, setAppTimezone] = useState("Asia/Jakarta");
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const response = await api.get("/system/config/branding");
      const data = response.data;
      if (data) {
        if (data.appName) setAppName(data.appName);
        if (data.appLogo) setAppLogo(data.appLogo);
        if (data.appTitle) setAppTitle(data.appTitle);
        if (data.appFavicon) setAppFavicon(data.appFavicon);
        if (data.appFooter) setAppFooter(data.appFooter);
        if (data.appTimezone) setAppTimezone(data.appTimezone);

        // Apply Tab Title dynamically
        if (data.appTitle) {
          document.title = data.appTitle;
        }

        // Apply Favicon dynamically
        if (data.appFavicon) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.getElementsByTagName("head")[0].appendChild(link);
          }
          link.href = data.appFavicon;
        }
      }
    } catch (e) {
      console.error("Failed to load branding assets:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const formatDate = (date: string | Date | number, options: Intl.DateTimeFormatOptions = {}) => {
    if (!date) return "-";
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return "-";

    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...options,
      timeZone: appTimezone || "Asia/Jakarta",
    };

    return dateObj.toLocaleDateString("en-GB", defaultOptions);
  };

  return (
    <BrandingContext.Provider
      value={{
        appName,
        appLogo,
        appTitle,
        appFavicon,
        appFooter,
        appTimezone,
        isLoading,
        refreshBranding: fetchBranding,
        formatDate,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return context;
}
