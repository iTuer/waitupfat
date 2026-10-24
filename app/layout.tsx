import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "嘴巴等等我 · 每一口，都有人陪",
  description: "记录每一餐，和朋友一起报备、投票、收集好好吃饭的成就。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
