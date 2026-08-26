import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AuthModal from "../components/AuthModal";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "DocFlow — Everything you need for your documents, in one place",
  description: "Complete production SaaS platform for merging, splitting, compressing, converting, editing, signing, redacting PDFs, Voice to Document, and Indian Language OCR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Caveat:wght@600&family=Dancing+Script:wght@600&family=Great+Vibes&family=Homemade+Apple&family=Marck+Script&family=Pacifico&family=Sacramento&family=Satisfy&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased min-h-screen flex flex-col`}>
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
