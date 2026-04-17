import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useModule } from '../contexts/ModuleContext'
import { useLayout } from './Layout'
import type { ModuleKey } from '../types'

interface NavItem {
  to: string
  label: string
  icon: string
  badge?: string
}

const NAV: Record<ModuleKey, NavItem[]> = {
  rh: [
    { to: '/rh/indicadores', label: 'Indicadores', icon: '◈' },
    { to: '/rh/vagas', label: 'Vagas', icon: '◱' },
    { to: '/rh/candidatos', label: 'Candidatos', icon: '◉' },
    { to: '/rh/onboarding', label: 'Onboarding', icon: '⚑' },
    { to: '/rh/usuarios', label: 'Usuários', icon: '◔' },
  ],
  dp: [
    { to: '/dp/dashboard', label: 'Dashboard DP', icon: '◈' },
    { to: '/dp/estagiarios', label: 'Estagiários', icon: '◱' },
    { to: '/dp/colaboradores', label: 'Colaboradores', icon: '◉' },
    { to: '/dp/periodo-experiencia', label: 'Período de Experiência', icon: '⧗' },
  ],
}

const GESTOR_NAV: NavItem[] = [
  { to: '/gestor/minhas-vagas', label: 'Minhas vagas', icon: '◱' },
  { to: '/gestor/nova', label: 'Abrir nova vaga', icon: '＋' },
  { to: '/gestor/candidatos', label: 'Candidatos', icon: '◉' },
]

function initials(name?: string | null) {
  if (!name) return 'ET'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'ET'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Sidebar() {
  const { profile, logout } = useAuth()
  const { module, setModule } = useModule()
  const location = useLocation()
  const navigate = useNavigate()
  const { setMobileOpen } = useLayout()

  const isRh = profile?.role === 'rh'
  const navItems = isRh ? NAV[module] : GESTOR_NAV

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function switchModule(m: ModuleKey) {
    if (!isRh) return
    setModule(m)
    const first = NAV[m][0]
    navigate(first.to)
    setMobileOpen(false)
  }

  function handleNavClick() {
    setMobileOpen(false)
  }

  return (
    <aside className="sb">
      <div className="sb-top">
        <div className="sb-logo">
          <span className="sb-logo-dot" />
          ETUS
        </div>
        <div className="sb-logo-sub">Gestão integrada</div>
      </div>

      {isRh && (
        <div className="sb-mods">
          <div className="sb-lbl">Módulos</div>
          <div className="vstack" style={{ gap: 4 }}>
            <div
              className={'sb-mod' + (module === 'rh' ? ' on' : '')}
              onClick={() => switchModule('rh')}
              role="button"
              tabIndex={0}
            >
              RH — Recrutamento
              <span className="mdot" />
            </div>
            <div
              className={'sb-mod' + (module === 'dp' ? ' on' : '')}
              onClick={() => switchModule('dp')}
              role="button"
              tabIndex={0}
            >
              DP — Dept. Pessoal
              <span className="mdot" />
            </div>
          </div>
        </div>
      )}

      <nav className="sb-nav">
        <div className="sb-nav-sec">Navegação</div>
        {navItems.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/')
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={'sb-item' + (active ? ' on' : '')}
            >
              <span className="sb-icon">{item.icon}</span>
              {item.label}
              {item.badge && <span className="sb-badge">{item.badge}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="sb-foot">
        <div className="sb-urow">
          <div className="sb-uav">{initials(profile?.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sb-uname" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.name || '—'}</div>
            <div className="sb-urole">{profile?.role === 'rh' ? 'RH' : 'Gestor'}</div>
          </div>
          <div className="sb-ulive">
            <span className="sb-uld" />
            live
          </div>
        </div>
        <button className="sb-logout" onClick={handleLogout} type="button">
          Sair
        </button>
      </div>
    </aside>
  )
}
