import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import RhDashboard from './pages/rh/Dashboard'
import RhTodasVagas from './pages/rh/TodasVagas'
import RhVagaDetalhe from './pages/rh/VagaDetalhe'
import RhUsuarios from './pages/rh/Usuarios'
import GestorMinhasVagas from './pages/gestor/MinhasVagas'
import GestorNovaVaga from './pages/gestor/NovaVaga'
import GestorVagaDetalhe from './pages/gestor/VagaDetalhe'

function RoleRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <div style={{ padding: 40 }}>Carregando…</div>
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={profile.role === 'rh' ? '/rh' : '/gestor'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/rh"
        element={
          <ProtectedRoute role="rh">
            <Layout>
              <RhDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rh/vagas"
        element={
          <ProtectedRoute role="rh">
            <Layout>
              <RhTodasVagas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rh/vagas/:id"
        element={
          <ProtectedRoute role="rh">
            <Layout>
              <RhVagaDetalhe />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rh/usuarios"
        element={
          <ProtectedRoute role="rh">
            <Layout>
              <RhUsuarios />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/gestor"
        element={
          <ProtectedRoute role="gestor">
            <Layout>
              <GestorMinhasVagas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/gestor/nova"
        element={
          <ProtectedRoute role="gestor">
            <Layout>
              <GestorNovaVaga />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/gestor/vagas/:id"
        element={
          <ProtectedRoute role="gestor">
            <Layout>
              <GestorVagaDetalhe />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<RoleRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
