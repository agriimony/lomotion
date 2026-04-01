import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const miniAppEmbed = {
  version: "1",
  imageUrl: "https://lomotion.vercel.app/api/og",
  button: {
    title: "LoMotion",
    action: {
      type: "launch_frame",
      name: "LoMotion",
      url: "https://lomotion.vercel.app/",
      splashBackgroundColor: "#171916",
    },
  },
};

export const metadata: Metadata = {
  title: "LoMotion",
  description: "low-fi motion graphics",
  openGraph: {
    title: "LoMotion",
    description: "low-fi motion graphics",
    images: ["https://lomotion.vercel.app/api/og"],
  },
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
