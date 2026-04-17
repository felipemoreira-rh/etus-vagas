import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ModuleKey } from '../types'

interface ModuleContextValue {
  module: ModuleKey
  setModule: (m: ModuleKey) => void
}

const ModuleContext = createContext<ModuleContextValue | undefined>(undefined)

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [module, setModule] = useState<ModuleKey>('rh')
  const value = useMemo(() => ({ module, setModule }), [module])
  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>
}

export function useModule() {
  const ctx = useContext(ModuleContext)
  if (!ctx) throw new Error('useModule must be used within ModuleProvider')
  return ctx
}
