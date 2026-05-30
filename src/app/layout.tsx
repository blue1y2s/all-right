import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "All Right | 多平台内容发布工具",
  description: "面向创作者的多平台内容适配、预览和模拟发布工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
