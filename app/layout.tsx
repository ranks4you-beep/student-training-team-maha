import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Student Training — Team Workspace",
  description: "A shared bilingual workspace for student training, assignments and team coordination.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
