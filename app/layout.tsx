import type { Metadata } from "next";
import "./globals.css";
import { NavigationBar } from "./components/layout/NavigationBar";

export const metadata: Metadata = {
  title: "LandPilot - Live and historical Landing market rates by DAO Pilot",
  description: "Live and historical Landing market rates by DAO Pilot",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NavigationBar />
        {children}
      </body>
    </html>
  );
}
