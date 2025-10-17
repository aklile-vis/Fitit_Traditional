'use client'

import { createContext, useContext, useEffect } from 'react'

type Theme = 'light'

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (value: Theme) => void
}

const defaultThemeValue: ThemeContextValue = {
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    root.dataset.theme = 'light'
  }, [])

  return <ThemeContext.Provider value={defaultThemeValue}>{children}</ThemeContext.Provider>
}
