import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import DefaultCollapsedProfileTabs from "@/components/DefaultCollapsedProfileTabs";
import ChallengeCompletionRedirect from "@/components/ChallengeCompletionRedirect";
import { clerkPublishableKey } from "@/lib/clerk";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KG Stay Active Challenge",
  description: "Track fitness activities and compete in leaderboards",
  applicationName: "KG Active",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "KG Active" },
  icons: { icon: [{ url: "/kg-gorilla-192.png", sizes: "192x192", type: "image/png" },{ url: "/kg-gorilla-512.png", sizes: "512x512", type: "image/png" }], apple: [{ url: "/kg-gorilla-apple.png", sizes: "180x180", type: "image/png" }] },
};
export const viewport: Viewport = { themeColor: "#07122f", colorScheme: "dark light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  const content = <body className="min-h-full flex flex-col"><Providers clerkEnabled={Boolean(clerkPublishableKey)}><DefaultCollapsedProfileTabs/><ChallengeCompletionRedirect/>{children}</Providers></body>;
  return <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>{clerkPublishableKey ? <ClerkProvider publishableKey={clerkPublishableKey} signInUrl="/auth/login" signUpUrl="/auth/login" afterSignOutUrl="/">{content}</ClerkProvider> : content}</html>;
}
