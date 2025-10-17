import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import Layout from '@/components/Layout/Layout'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EstatePro - Modern Real Estate Platform',
  description: 'Discover amazing properties with interactive 3D tours and virtual walkthroughs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress React DevTools version parsing error
              if (typeof window !== 'undefined') {
                const originalConsoleError = console.error;
                const originalConsoleWarn = console.warn;
                
                console.error = function(...args) {
                  const message = args[0];
                  if (typeof message === 'string' && (
                    message.includes('Invalid argument not valid semver') ||
                    message.includes('validateAndParse') ||
                    message.includes('esm_compareVersions')
                  )) {
                    return; // Suppress React DevTools errors
                  }
                  originalConsoleError.apply(console, args);
                };
                
                console.warn = function(...args) {
                  const message = args[0];
                  if (typeof message === 'string' && (
                    message.includes('Invalid argument not valid semver') ||
                    message.includes('validateAndParse') ||
                    message.includes('esm_compareVersions')
                  )) {
                    return; // Suppress React DevTools warnings
                  }
                  originalConsoleWarn.apply(console, args);
                };
                
                // Also suppress uncaught errors
                window.addEventListener('error', function(event) {
                  if (event.message && event.message.includes('Invalid argument not valid semver')) {
                    event.preventDefault();
                    return false;
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <Layout>
                {children}
              </Layout>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
