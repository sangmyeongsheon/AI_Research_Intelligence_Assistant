import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { PRODUCT_CONFIG } from "@/src/config/product";
import "./globals.css";

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
    icon: [{ url: PRODUCT_CONFIG.logoSrc, type: "image/png" }],
    shortcut: PRODUCT_CONFIG.logoSrc,
    apple: PRODUCT_CONFIG.logoSrc,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: PRODUCT_CONFIG.fullName,
    title: `${PRODUCT_CONFIG.name} — 근거가 연결된 랩 프로토콜`,
    description: PRODUCT_CONFIG.description,
    images: [
      {
        url: PRODUCT_CONFIG.socialImageSrc,
        width: 1731,
        height: 909,
        alt: "ARIA — AI Research Intelligence Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_CONFIG.name} — 근거가 연결된 랩 프로토콜`,
    description: PRODUCT_CONFIG.description,
    images: [PRODUCT_CONFIG.socialImageSrc],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        style={
          {
            "--aria-logo-url": `url("${PRODUCT_CONFIG.logoSrc}")`,
          } as CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
