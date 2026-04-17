import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'
import type { ReactNode } from 'react'

interface Props {
  role?: Role
  children: ReactNode
}

export default function ProtectedRoute({ role, children }: Props) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        Carregando…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/login" replace />
  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'rh' ? '/rh' : '/gestor'} replace />
  }

  return <>{children}</>
}
