import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { IBM_Plex_Sans_Thai, Noto_Sans_Thai, Nunito } from "next/font/google";
import "./globals.css";
import { DataProvider } from "./lib/store";
import { LangProvider } from "./lib/lang";
import { TabBar } from "./components/TabBar";
import { OnboardingGate } from "./components/OnboardingGate";
import { ChatFab } from "./components/ChatFab";
import { PasscodeBox } from "./components/PasscodeBox";

const thai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

// Soft, round font for numbers.
const roundLatin = Nunito({
  variable: "--font-round-latin",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// "Frosted Calm" look (Round 30+): thin, airy Thai + numbers.
const calm = IBM_Plex_Sans_Thai({
  variable: "--font-calm",
  subsets: ["thai", "latin"],
  weight: ["200", "300", "400", "500"],
});

export const metadata: Metadata = {
  title: "SnapCal",
  description: "ถ่ายรูปนับแคล บันทึกอาหาร น้ำหนัก และจำนวนก้าว",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SnapCal",
  },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
  // The card shown when the link is shared in WhatsApp / LINE / Messages.
  metadataBase: new URL("https://yani-food-diary.vercel.app"),
  openGraph: {
    title: "SnapCal",
    description: "ถ่ายรูปอาหาร ให้ AI ช่วยนับแคล · บันทึกน้ำหนักและจำนวนก้าว",
    url: "/",
    siteName: "SnapCal",
    type: "website",
    locale: "th_TH",
  },
  twitter: { card: "summary_large_image", title: "SnapCal", description: "ถ่ายรูปอาหาร ให้ AI ช่วยนับแคล · บันทึกน้ำหนักและจำนวนก้าว" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4efe7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${thai.variable} ${roundLatin.variable} ${calm.variable} h-full antialiased`}>
      <body className="calm min-h-full">
        {/* Beige page + 3 soft color clouds behind every page. */}
        <div className="calm-backdrop" aria-hidden />
        <LangProvider>
          <DataProvider>
            <Suspense>
              <OnboardingGate>
                {children}
                <TabBar />
                <ChatFab />
              </OnboardingGate>
              <PasscodeBox />
            </Suspense>
          </DataProvider>
        </LangProvider>
      </body>
    </html>
  );
}
