import type { Metadata } from "next";
import LibraryExplorer from "./LibraryExplorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PPT 历史配图库",
  description: "按主题、关键词、期数与页码检索团队历史 PPT 页面。",
};

export default function Home() {
  return <LibraryExplorer />;
}
