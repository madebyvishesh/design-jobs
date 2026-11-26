import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import "./board.css";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Design Jobs — Product, UX, Brand & Motion Roles",
  description:
    "Design jobs at YC startups and top tech companies. Product designer, UX, brand, motion, and design engineering roles.",
  keywords: "design jobs,product designer,ux designer,design engineer,brand designer,startup design jobs,ai company careers,tech design jobs",
  openGraph: {
    title: "Design Jobs — Product, UX, Brand & Motion Roles",
    description:
      "Browse curated design and design engineering jobs at the world's leading AI companies and top startups.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Design Jobs — Product, UX, Brand & Motion Roles",
    description: "Browse curated design roles at top AI companies and startups.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `
    (function () {
      try {
        var stored = window.localStorage.getItem('design-jobs:theme');
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        var dark = stored ? stored === 'dark' : prefersDark;
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      } catch (error) {}
    })();
  `;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased">
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
