import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface NavItem {
  to: string
  label: string
  icon: string
}

const rhNav: NavItem[] = [
  { to: '/rh', label: 'Dashboard', icon: '▦' },
  { to: '/rh/vagas', label: 'Todas as vagas', icon: '◇' },
  { to: '/rh/usuarios', label: 'Usuários', icon: '◉' },
]
const gestorNav: NavItem[] = [
  { to: '/gestor', label: 'Minhas vagas', icon: '◇' },
  { to: '/gestor/nova', label: 'Abrir nova vaga', icon: '+' },
]

export default function Sidebar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const nav = profile?.role === 'rh' ? rhNav : gestorNav

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">ETUS</div>
        <div className="subtitle">Abertura de Vagas</div>
      </div>

      <div className="section-label">
        {profile?.role === 'rh' ? 'RH — Time de Gente' : 'Gestor'}
      </div>

      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/rh' || item.to === '/gestor'}
          className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
        >
          <span style={{ width: 18, textAlign: 'center', fontSize: 16 }}>{item.icon}</span>
          {item.label}
        </NavLink>
      ))}

      <div className="user-box">
        <div>
          <div className="name">{profile?.name}</div>
          <div className="role">{profile?.email}</div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={handleLogout} style={{ color: 'var(--neutral-50)', borderColor: 'var(--neutral-700)' }}>
          Sair
        </button>
      </div>
    </aside>
  )
}
