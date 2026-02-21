import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { StoreHydrator } from "@/components/system/store-hydrator";
import "./globals.css";

export const metadata: Metadata = {
  title: "IUI - AI Educational Platform",
  description: "Modern SaaS dashboard for AI-powered education."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-[var(--font-manrope)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <StoreHydrator />
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
