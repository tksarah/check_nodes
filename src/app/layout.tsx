import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peers Program Dashboard",
  description: "Astar Network archive node uptime monitoring portal",
  icons: {
    icon: "/brand/astar-symbol-color.png",
    shortcut: "/brand/astar-symbol-color.png",
    apple: "/brand/astar-symbol-color.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <footer className="app-footer">builder: tksarah</footer>
      </body>
    </html>
  );
}
