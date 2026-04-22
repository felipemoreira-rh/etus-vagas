import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { useAuth } from '../contexts/AuthContext'
import { auth } from '../firebase'
import { allowedDomainsHuman, isEmailAllowed } from '../utils/authAllowlist'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

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

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      // Força o seletor de conta — evita login automático com conta errada.
      provider.setCustomParameters({ prompt: 'select_account' })
      const cred = await signInWithPopup(auth, provider)
      const email = cred.user.email ?? ''
      if (!isEmailAllowed(email)) {
        // Fora da allowlist — desloga e mostra erro. (Continua existindo um
        // registro órfão no Firebase Auth; limpeza automática exigiria
        // Cloud Function com Admin SDK — está documentado como follow-up.)
        await signOut(auth)
        setError(`Somente e-mails dos domínios ${allowedDomainsHuman()} podem entrar com Google.`)
        return
      }
      // Criação do doc users/{uid} no primeiro login é feita pelo AuthContext
      // dentro do onAuthStateChanged — evita race entre o listener ver
      // profile=null e o handler aqui gravar o doc. Aqui só navegamos; o
      // RoleRedirect aguarda `loading=false` antes de decidir a rota.
      navigate('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao entrar com Google.'
      setError(traduzirErro(message))
    } finally {
      setGoogleLoading(false)
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
          <button className="btn btn-primary" type="submit" disabled={loading || googleLoading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="auth-divider"><span>ou</span></div>

          <button
            type="button"
            className="btn btn-ghost btn-google"
            onClick={handleGoogle}
            disabled={loading || googleLoading}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3c-2 1.5-4.5 2.5-7.3 2.5-5.3 0-9.7-3.4-11.3-8l-6.5 5c3.3 6.4 10 10.9 17.8 10.9z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.5l6.3 5.3C41.2 36.3 45 30.7 45 24c0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            {googleLoading ? 'Entrando com Google…' : 'Entrar com Google'}
          </button>
          <p className="hint" style={{ marginTop: 4, textAlign: 'center' }}>
            Liberado para os domínios {allowedDomainsHuman()}.
          </p>

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
  if (msg.includes('auth/popup-closed-by-user')) return 'Login com Google cancelado.'
  if (msg.includes('auth/popup-blocked')) return 'Pop-up bloqueado pelo navegador. Permita pop-ups pra esse site.'
  if (msg.includes('auth/operation-not-allowed')) return 'Login com Google não está habilitado no Firebase Console (Authentication → Sign-in method).'
  if (msg.includes('auth/unauthorized-domain')) return 'Domínio não autorizado no Firebase Auth. Adicione em Authentication → Settings → Authorized domains.'
  return msg
}
