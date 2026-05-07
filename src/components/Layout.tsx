import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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

  // Marca o body enquanto o shell autenticado está montado pra travar o
  // overflow do body (a rolagem é interna em .content). Páginas públicas
  // (ex.: /sorteio/:id) não usam Layout, então rolam no body normalmente.
  useEffect(() => {
    document.body.classList.add('app-shell-active')
    return () => { document.body.classList.remove('app-shell-active') }
  }, [])

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
