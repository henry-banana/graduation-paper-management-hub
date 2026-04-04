import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { RoleSwitcher } from "@/components/dev/role-switcher";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: '--font-inter' });
const manrope = Manrope({ subsets: ["latin", "vietnamese"], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: "The Academic Curator",
  description: "Graduation Paper Management Hub - HCM UTE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showRoleSwitcher =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_ROLE_SWITCHER === "true";

  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} ${manrope.variable} font-body bg-surface text-on-surface antialiased`}>
        {children}
        {showRoleSwitcher && <RoleSwitcher />}
      </body>
    </html>
  );
}
