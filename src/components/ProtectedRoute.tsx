import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'
import type { ReactNode } from 'react'

interface Props {
  role?: Role | Role[]
  children: ReactNode
}

/** Para onde redirecionar uma role quando o ProtectedRoute recusar acesso. */
export function homeForRole(role: Role): string {
  switch (role) {
    case 'rh': return '/rh/indicadores'
    case 'gestor': return '/gestor/minhas-vagas'
    case 'estagiario':
    case 'colaborador':
    case 'prestador':
      return '/me'
  }
}

export default function ProtectedRoute({ role, children }: Props) {
  const { user, profile, loading } = useAuth()

  if (loading) return <div className="app-loader">Carregando…</div>

  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/login" replace />
  if (role) {
    const allowed = Array.isArray(role) ? role : [role]
    if (!allowed.includes(profile.role)) {
      return <Navigate to={homeForRole(profile.role)} replace />
    }
  }

  return <>{children}</>
}
