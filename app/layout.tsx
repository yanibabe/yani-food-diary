import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { DataProvider } from "./lib/store";
import { LangProvider } from "./lib/lang";
import { TabBar } from "./components/TabBar";
import { OnboardingGate } from "./components/OnboardingGate";

const thai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Yani Food Diary",
  description: "บันทึกอาหารประจำวัน ถ่ายรูปให้ AI ช่วยนับแคลอรี และเก็บสูตรของฉัน",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Food Diary",
  },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf6ec",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="min-h-full">
        <LangProvider>
          <DataProvider>
            <Suspense>
              <OnboardingGate>
                {children}
                <TabBar />
              </OnboardingGate>
            </Suspense>
          </DataProvider>
        </LangProvider>
      </body>
    </html>
  );
}
