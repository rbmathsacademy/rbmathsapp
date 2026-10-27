import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

// Date-based domain switch, done in the visitor's browser (no server cost):
// 10th-24th (India time) -> rbmathsapp9.vercel.app, other days -> rbmathsapp92.vercel.app.
// It replaces the old middleware, which ran on every request and was billed as Vercel CPU.
const DOMAIN_SWITCH = "(function(){try{var h=location.hostname,a='rbmathsapp9.vercel.app',b='rbmathsapp92.vercel.app';if(h!==a&&h!==b)return;var d=new Date(Date.now()+19800000).getUTCDate();var t=(d>=10&&d<=24)?a:b;if(h!==t)location.replace('https://'+t+location.pathname+location.search+location.hash);}catch(e){}})();";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RB Maths Question Bank",
  description: "RB Maths Question Bank Portal",
  manifest: "/manifest.json?v=2",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RB Maths",
  }
};

export const viewport = {
  themeColor: "#0a0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: DOMAIN_SWITCH }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
