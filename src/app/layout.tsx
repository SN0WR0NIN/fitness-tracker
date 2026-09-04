import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KG Stay Active Challenge",
  description: "Track fitness activities and compete in leaderboards",
  applicationName: "KG Active",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KG Active",
  },
  icons: {
    icon: "/app-icon.svg",
    apple: "/2902.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: "#07122f",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
