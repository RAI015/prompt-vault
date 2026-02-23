import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Prompt Vault",
  description: "Personal prompt vault",
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
