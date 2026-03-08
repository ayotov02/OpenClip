import type { Metadata } from "next";
import { Outfit, DM_Sans, JetBrains_Mono } from "next/font/google";
import { SmoothScrollProvider } from "@/providers/smooth-scroll";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenClip — The Open-Source Video Platform",
  description:
    "Free forever. No watermarks. Self-hosted. The open-source AI video platform for creators.",
  openGraph: {
    title: "OpenClip — The Open-Source Video Platform",
    description:
      "Free forever. No watermarks. Self-hosted. The open-source AI video platform for creators.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
