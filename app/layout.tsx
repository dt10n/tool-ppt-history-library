import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PPT 历史配图库",
  description: "银行螺丝钉团队历史 PPT 图片检索与复用工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
