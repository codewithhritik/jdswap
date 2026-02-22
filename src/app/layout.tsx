import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JDSwap — Tailor Your Resume",
  description:
    "Paste your resume and a job description. Get a tailored, ATS-optimized 1-page resume PDF in seconds.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      style={{ colorScheme: "dark" }}
      className={`${instrumentSerif.variable} ${bricolageGrotesque.variable} ${ibmPlexMono.variable}`}
    >
      <body className="bg-base text-warm font-body antialiased touch-manipulation">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:outline-none"
        >
          Skip to Main Content
        </a>
        {children}
      </body>
    </html>
  );
}
