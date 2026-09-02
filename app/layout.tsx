import type { Metadata, Viewport } from 'next';
import { Lexend } from 'next/font/google';
import './globals.css';

// Highly legible geometric sans-serif specifically optimized for reading ease and cognitive clarity
const lexend = Lexend({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lexend',
  weight: ['400', '500', '600', '700', '800'],
});

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // Never disable user scaling for elderly/low-vision users
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'Care Companion | Gentle Cognitive Support',
  description: 'An accessible, calming interactive companion for cognitive wellness and memory support.',
  manifest: '/manifest.json',
  applicationName: 'Care Companion',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Care Companion',
  },
  formatDetection: {
    telephone: true,
  },
};

import GlobalLoader from '@/components/GlobalLoader';

import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={lexend.variable} suppressHydrationWarning>
      <body className="font-sans min-h-screen flex flex-col bg-surface-light text-content-primary selection:bg-accessible-blue selection:text-white transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="light">
          <GlobalLoader>
            {/* Accessible skip link for keyboard & screen reader accessibility */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-6 focus:py-3 focus:bg-accessible-blue focus:text-white focus:rounded-xl focus:shadow-xl focus:border-2 focus:border-white focus:text-accessible-base"
            >
              Skip to main content
            </a>

            {/* Main accessible content container */}
            <main
              id="main-content"
              className="flex-1 w-full flex flex-col focus:outline-none"
              tabIndex={-1}
              role="main"
            >
              {children}
            </main>
          </GlobalLoader>
        </ThemeProvider>
      </body>
    </html>
  );
}
