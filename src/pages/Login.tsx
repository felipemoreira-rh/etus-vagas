import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao entrar.'
      setError(traduzirErro(message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="logo">
          <img src="/logo-etus-white.png" alt="ETUS" className="auth-logo-img" />
        </div>
        <div>
          <h2>
            Gestão integrada em um <span>só lugar</span>.
          </h2>
          <p>
            Recrutamento e Departamento Pessoal no mesmo cockpit. Acompanhe cada vaga,
            candidato e colaborador do Grupo ETUS.
          </p>
        </div>
        <div className="footnote">Time de Gente · Grupo ETUS</div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <h1>Entrar</h1>
            <p>Acesse sua conta para continuar.</p>
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label>E-mail corporativo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          <p style={{ fontSize: 12 }}>
            Ainda não tem conta? <Link to="/signup" style={{ color: 'var(--g600)', fontWeight: 600 }}>Criar conta</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

function traduzirErro(msg: string): string {
  if (msg.includes('auth/invalid-credential')) return 'E-mail ou senha incorretos.'
  if (msg.includes('auth/user-not-found')) return 'Usuário não encontrado.'
  if (msg.includes('auth/wrong-password')) return 'Senha incorreta.'
  if (msg.includes('auth/too-many-requests')) return 'Muitas tentativas. Tente novamente em alguns minutos.'
  if (msg.includes('auth/network-request-failed')) return 'Falha de conexão. Verifique sua internet.'
  return msg
}
