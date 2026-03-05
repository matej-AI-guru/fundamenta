import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const BASE_URL = "https://fundamenta-analiza.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Fundamenta — Screener dionica Zagrebačke burze",
  description:
    "Jedini napredni fundamentalni screener za ZSE. Filtriraj sve dionice po P/E, ROCE, EV/EBITDA i 10+ pokazatelja. Besplatno, bez registracije.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Fundamenta",
    locale: "hr_HR",
    title: "Fundamenta — Screener dionica Zagrebačke burze",
    description:
      "Filtriraj dionice ZSE po P/E, ROCE, EV/EBITDA i 10+ fundamentalnih pokazatelja. Besplatno, bez registracije.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fundamenta — Screener dionica Zagrebačke burze",
    description:
      "Filtriraj dionice ZSE po P/E, ROCE, EV/EBITDA i 10+ pokazatelja.",
  },
  other: {
    "geo.region": "HR",
    "geo.placename": "Zagreb",
    language: "hr",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Fundamenta",
  description:
    "Fundamentalni screener dionica Zagrebačke burze (ZSE). Filtriraj po P/E, ROCE, EV/EBITDA, P/B i 10+ pokazatelja.",
  url: BASE_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  inLanguage: "hr",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Investitori, value investitori, dioničari",
  },
  provider: {
    "@type": "Organization",
    name: "Fundamenta",
    url: BASE_URL,
    // TODO: dodati "logo" i "contactPoint" kad budu poznati
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
