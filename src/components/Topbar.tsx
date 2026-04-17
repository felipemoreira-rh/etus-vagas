import { useLocation } from 'react-router-dom'
import { useModule } from '../contexts/ModuleContext'
import { useAuth } from '../contexts/AuthContext'
import { useLayout } from './Layout'
import { MODULE_LABEL } from '../types'
import type { ReactNode } from 'react'

interface TopbarProps {
  title: string
  icon?: string
  actions?: ReactNode
}

export default function Topbar({ title, icon = '◈', actions }: TopbarProps) {
  const { module } = useModule()
  const { profile } = useAuth()
  const location = useLocation()
  const { mobileOpen, setMobileOpen } = useLayout()

  const crumb = profile?.role === 'gestor'
    ? 'Gestor'
    : MODULE_LABEL[module]

  return (
    <header className="topbar">
      <div className="tb-l">
        <button
          type="button"
          className="tb-burger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          <span /><span /><span />
        </button>
        <div className="tb-title">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <div className="tb-crumb">
          <span className="tb-crumb-sep">/</span>
          <span>{crumb}</span>
          <span className="tb-crumb-sep">/</span>
          <span>{pathTail(location.pathname)}</span>
        </div>
      </div>
      <div className="tb-r">{actions}</div>
    </header>
  )
}

function pathTail(path: string) {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] || '—'
}
