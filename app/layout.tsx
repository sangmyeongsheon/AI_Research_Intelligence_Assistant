import type { Metadata } from "next";
import { PRODUCT_CONFIG } from "@/src/config/product";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: `${PRODUCT_CONFIG.name} — 근거가 연결된 랩 프로토콜`,
    template: `%s · ${PRODUCT_CONFIG.name}`,
  },
  description: PRODUCT_CONFIG.description,
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: `${PRODUCT_CONFIG.name} — 근거가 연결된 랩 프로토콜`,
    description: PRODUCT_CONFIG.description,
  },
  twitter: {
    card: "summary",
    title: `${PRODUCT_CONFIG.name} — 근거가 연결된 랩 프로토콜`,
    description: PRODUCT_CONFIG.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
