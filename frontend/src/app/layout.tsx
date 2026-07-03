import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YATO | Infrastructure Platform",
  description: "Next-gen internal infrastructure management platform",
  icons: {
    icon: "/icon.png",
  },
};

import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-slate-50">
      <body>
        <ErrorBoundary>
          <Providers>
            <div className="fixed inset-0 bg-slate-50 -z-10" />
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full -z-10" />
            <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/10 blur-[120px] rounded-full -z-10" />
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
