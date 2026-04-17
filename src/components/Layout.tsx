import { createContext, useContext, useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'

interface LayoutContextType {
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

const LayoutContext = createContext<LayoutContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
})

export function useLayout() {
  return useContext(LayoutContext)
}

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <LayoutContext.Provider value={{ mobileOpen, setMobileOpen }}>
      <div className={'shell' + (mobileOpen ? ' mobile-open' : '')}>
        {mobileOpen && (
          <div
            className="mobile-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}
        <Sidebar />
        <div className="main">{children}</div>
      </div>
    </LayoutContext.Provider>
  )
}
