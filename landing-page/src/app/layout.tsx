import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { SmoothScrollProvider } from "@/providers/smooth-scroll";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenClip — Free, Open-Source AI Video Creation Platform",
  description:
    "The open-source OpusClip alternative. Create viral clips, faceless videos, and AI captions — free forever, no watermarks, self-hosted.",
  keywords: [
    "AI video editor",
    "OpusClip alternative",
    "open source video",
    "faceless video",
    "AI captions",
  ],
  openGraph: {
    title: "OpenClip — Free AI Video Creation",
    description:
      "Replace OpusClip ($29/mo) with a free, open-source alternative. Self-hosted, no watermarks.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0A0A0B] text-[#FAFAFA]`}
      >
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
