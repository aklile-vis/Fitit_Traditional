'use client'

import { ReactNode } from 'react'

import Footer from './Footer'
import Header from './Header'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen bg-[color:var(--app-background)] flex flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(198,138,63,0.28),transparent_65%)] blur-3xl" />
        <div className="absolute right-[-18rem] top-[35%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(154,119,84,0.25),transparent_70%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-[-20rem] h-[30rem] bg-[radial-gradient(circle_at_center,rgba(57,41,28,0.6),transparent_72%)]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <Header />
        <main className="flex-1 pb-20 pt-12">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}
