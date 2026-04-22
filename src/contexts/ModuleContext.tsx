import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ModuleKey } from '../types'

interface ModuleContextValue {
  module: ModuleKey
  setModule: (m: ModuleKey) => void
}

const ModuleContext = createContext<ModuleContextValue | undefined>(undefined)

function moduleFromPath(pathname: string): ModuleKey {
  if (pathname.startsWith('/dp')) return 'dp'
  return 'rh'
}

const MODULE_HOME: Record<ModuleKey, string> = {
  rh: '/rh/indicadores',
  dp: '/dp/dashboard',
}

export function ModuleProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [module, setModuleState] = useState<ModuleKey>(() => moduleFromPath(location.pathname))

  // Mantém o módulo sincronizado com a URL (ex.: refresh em /dp/* mantém DP).
  useEffect(() => {
    const m = moduleFromPath(location.pathname)
    setModuleState((curr) => (curr === m ? curr : m))
  }, [location.pathname])

  const setModule = useCallback((m: ModuleKey) => {
    setModuleState(m)
    navigate(MODULE_HOME[m])
  }, [navigate])

  const value = useMemo(() => ({ module, setModule }), [module, setModule])
  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>
}

export function useModule() {
  const ctx = useContext(ModuleContext)
  if (!ctx) throw new Error('useModule must be used within ModuleProvider')
  return ctx
}
