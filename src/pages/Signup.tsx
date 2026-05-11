import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [area, setArea] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Toda nova conta começa como prestador. O RH faz o ajuste de perfil
      // (gestor/RH/colaborador/estagiário) dentro do sistema depois.
      await signup({ email, password, name, role: 'prestador', empresa, area })
      navigate('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao criar conta.'
      setError(message)
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
            Construindo <span>novos times</span> com clareza.
          </h2>
          <p>
            Crie sua conta para abrir vagas, acompanhar candidatos e colaborar com o Time de Gente
            em cada contratação.
          </p>
        </div>
        <div className="footnote">Time de Gente · Grupo ETUS</div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <h1>Criar conta</h1>
            <p>Preencha os dados para acessar o sistema.</p>
          </div>
          {error && <div className="error-text">{error}</div>}

          <div className="field">
            <label>Nome completo</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>E-mail corporativo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Senha (mínimo 6 caracteres)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="field">
            <label>Empresa (opcional)</label>
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex.: ETUS" />
          </div>
          <div className="field">
            <label>Área / Time (opcional)</label>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex.: Tecnologia" />
          </div>
          <span className="hint" style={{ display: 'block', marginTop: -6 }}>
            Toda nova conta entra como <strong>prestador</strong>. O RH faz o ajuste de perfil
            (gestor, RH, colaborador ou estagiário) dentro do sistema depois.
          </span>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>
          <p style={{ fontSize: 12 }}>
            Já tem conta? <Link to="/login" style={{ color: 'var(--g600)', fontWeight: 600 }}>Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
