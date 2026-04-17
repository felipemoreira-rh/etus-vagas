import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ModuleProvider } from './contexts/ModuleContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'

// RH
import RhIndicadores from './pages/rh/Indicadores'
import RhTodasVagas from './pages/rh/TodasVagas'
import RhVagaDetalhe from './pages/rh/VagaDetalhe'
import RhNovaVaga from './pages/rh/NovaVaga'
import RhCandidatos from './pages/rh/Candidatos'
import RhCandidatoDetalhe from './pages/rh/CandidatoDetalhe'
import RhOnboarding from './pages/rh/Onboarding'
import RhOnboardingDetalhe from './pages/rh/OnboardingDetalhe'
import RhUsuarios from './pages/rh/Usuarios'

// DP
import DpDashboard from './pages/dp/Dashboard'
import DpEstagiarios from './pages/dp/Estagiarios'
import DpColaboradores from './pages/dp/Colaboradores'
import DpPeriodoExperiencia from './pages/dp/PeriodoExperiencia'

// FIN
import FinDashboard from './pages/fin/Dashboard'
import FinIfood from './pages/fin/Ifood'
import FinOutrosPagamentos from './pages/fin/OutrosPagamentos'

// Gestor
import GestorMinhasVagas from './pages/gestor/MinhasVagas'
import GestorNovaVaga from './pages/gestor/NovaVaga'
import GestorVagaDetalhe from './pages/gestor/VagaDetalhe'

function RoleRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <div className="app-loader">Carregando…</div>
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={profile.role === 'rh' ? '/rh/indicadores' : '/gestor/minhas-vagas'} replace />
}

function RhRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute role="rh">
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

function GestorRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute role="gestor">
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <ModuleProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* RH — Recrutamento */}
        <Route path="/rh" element={<Navigate to="/rh/indicadores" replace />} />
        <Route path="/rh/indicadores" element={<RhRoute><RhIndicadores /></RhRoute>} />
        <Route path="/rh/vagas" element={<RhRoute><RhTodasVagas /></RhRoute>} />
        <Route path="/rh/vagas/nova" element={<RhRoute><RhNovaVaga /></RhRoute>} />
        <Route path="/rh/vagas/:id" element={<RhRoute><RhVagaDetalhe /></RhRoute>} />
        <Route path="/rh/candidatos" element={<RhRoute><RhCandidatos /></RhRoute>} />
        <Route path="/rh/candidatos/:id" element={<RhRoute><RhCandidatoDetalhe /></RhRoute>} />
        <Route path="/rh/onboarding" element={<RhRoute><RhOnboarding /></RhRoute>} />
        <Route path="/rh/onboarding/:id" element={<RhRoute><RhOnboardingDetalhe /></RhRoute>} />
        <Route path="/rh/usuarios" element={<RhRoute><RhUsuarios /></RhRoute>} />

        {/* DP — Departamento Pessoal */}
        <Route path="/dp" element={<Navigate to="/dp/dashboard" replace />} />
        <Route path="/dp/dashboard" element={<RhRoute><DpDashboard /></RhRoute>} />
        <Route path="/dp/estagiarios" element={<RhRoute><DpEstagiarios /></RhRoute>} />
        <Route path="/dp/colaboradores" element={<RhRoute><DpColaboradores /></RhRoute>} />
        <Route path="/dp/periodo-experiencia" element={<RhRoute><DpPeriodoExperiencia /></RhRoute>} />

        {/* FIN — Financeiro & Notas */}
        <Route path="/fin" element={<Navigate to="/fin/ifood" replace />} />
        <Route path="/fin/ifood" element={<RhRoute><FinIfood /></RhRoute>} />
        <Route path="/fin/outros" element={<RhRoute><FinOutrosPagamentos /></RhRoute>} />
        <Route path="/fin/dashboard" element={<RhRoute><FinDashboard /></RhRoute>} />

        {/* Gestor */}
        <Route path="/gestor" element={<Navigate to="/gestor/minhas-vagas" replace />} />
        <Route path="/gestor/minhas-vagas" element={<GestorRoute><GestorMinhasVagas /></GestorRoute>} />
        <Route path="/gestor/nova" element={<GestorRoute><GestorNovaVaga /></GestorRoute>} />
        <Route path="/gestor/vagas/:id" element={<GestorRoute><GestorVagaDetalhe /></GestorRoute>} />

        <Route path="/" element={<RoleRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ModuleProvider>
  )
}
