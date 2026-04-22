import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut,
  type User,
} from 'firebase/auth'
import {
  doc, getDoc, onSnapshot, serverTimestamp, setDoc, Timestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { allowedDomainsHuman, isEmailAllowed } from '../utils/authAllowlist'
import type { Sorteio } from '../types'

// Página pública do sorteio. Standalone — não usa Layout nem Sidebar e
// não expõe nenhuma rota interna do sistema. A única informação que
// cruza com o app principal é o próprio id do sorteio.
export default function SorteioPublico() {
  const { id } = useParams<{ id: string }>()
  const [sorteio, setSorteio] = useState<Sorteio | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [inscrito, setInscrito] = useState<boolean | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-render a cada minuto pra janela de inscrições abrir/fechar na
  // hora certa mesmo com o usuário parado na página.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(
      doc(db, 'sorteios', id),
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true)
          setSorteio(null)
        } else {
          setSorteio({ id: snap.id, ...(snap.data() as Omit<Sorteio, 'id'>) })
          setNotFound(false)
        }
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [id])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setUserLoading(false)
    })
    return unsub
  }, [])

  // Checa se o usuário atual já está inscrito no sorteio (subcoleção
  // /sorteios/{id}/participantes/{uid}). Re-checa ao trocar de usuário.
  useEffect(() => {
    if (!id || !user) {
      setInscrito(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'sorteios', id, 'participantes', user.uid))
        if (!cancelled) setInscrito(snap.exists())
      } catch {
        if (!cancelled) setInscrito(null)
      }
    })()
    return () => { cancelled = true }
  }, [id, user])

  const fase = computeFase(sorteio, now)

  async function handleGoogleLogin() {
    if (!id) return
    setError(null)
    setGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const cred = await signInWithPopup(auth, provider)
      const email = cred.user.email ?? ''
      if (!isEmailAllowed(email)) {
        await signOut(auth)
        setError(`Esse sorteio é restrito aos domínios ${allowedDomainsHuman()}.`)
        return
      }
      await inscrever(cred.user)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao entrar com Google.'
      setError(traduzirErro(msg))
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleInscreverComConta() {
    if (!user) return
    setError(null)
    setGoogleLoading(true)
    try {
      if (!isEmailAllowed(user.email ?? '')) {
        setError(`Esse sorteio é restrito aos domínios ${allowedDomainsHuman()}.`)
        return
      }
      await inscrever(user)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao inscrever.'
      setError(traduzirErro(msg))
    } finally {
      setGoogleLoading(false)
    }
  }

  async function inscrever(u: User) {
    if (!id) return
    if (fase !== 'aberto') {
      setError('Inscrições não estão abertas no momento.')
      return
    }
    try {
      await setDoc(doc(db, 'sorteios', id, 'participantes', u.uid), {
        uid: u.uid,
        nome: u.displayName ?? u.email ?? u.uid,
        email: u.email ?? '',
        inscritoEm: serverTimestamp(),
      })
      setInscrito(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao inscrever.'
      // Permission-denied geralmente significa que o RH fechou inscrições
      // entre o carregamento da página e o clique.
      if (msg.includes('permission-denied') || msg.includes('insufficient')) {
        setError('As inscrições acabaram de fechar. Tente outro sorteio.')
      } else {
        setError(traduzirErro(msg))
      }
    }
  }

  async function handleSair() {
    await signOut(auth)
    setInscrito(null)
  }

  if (loading || userLoading) {
    return <div className="sp-shell"><div className="sp-card"><div className="sp-loader">Carregando…</div></div></div>
  }

  if (notFound || !sorteio) {
    return (
      <div className="sp-shell">
        <div className="sp-card">
          <div className="sp-logo">
            <img src="/logo-etus-white.png" alt="ETUS" />
          </div>
          <h1>Sorteio não encontrado</h1>
          <p className="muted">O link que você acessou não corresponde a nenhum sorteio ativo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="sp-shell">
      <div className="sp-card">
        <div className="sp-logo">
          <img src="/logo-etus-white.png" alt="ETUS" />
        </div>
        <div className="sp-title">
          <h1>{sorteio.titulo}</h1>
          {sorteio.descricao && <p className="muted">{sorteio.descricao}</p>}
        </div>

        <div className="sp-info">
          <div className="sp-info-row">
            <span className="sp-info-lbl">Prêmio</span>
            <span className="sp-info-val">{sorteio.premio}</span>
          </div>
          {sorteio.dataEvento && (
            <div className="sp-info-row">
              <span className="sp-info-lbl">Data do evento</span>
              <span className="sp-info-val">{fmtDate(sorteio.dataEvento)}</span>
            </div>
          )}
          <div className="sp-info-row">
            <span className="sp-info-lbl">Sorteio</span>
            <span className="sp-info-val">
              {fmtDateTime(sorteio.janelaSorteioInicio)} – {fmtTime(sorteio.janelaSorteioFim)}
            </span>
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}

        <SorteioAcao
          fase={fase}
          sorteio={sorteio}
          user={user}
          inscrito={inscrito}
          googleLoading={googleLoading}
          onGoogle={handleGoogleLogin}
          onInscrever={handleInscreverComConta}
          onSair={handleSair}
        />

        <div className="sp-foot">
          <div className="sp-foot-hint">
            Sorteio restrito a colaboradores dos domínios {allowedDomainsHuman()}.
          </div>
          <div className="sp-foot-etus">Time de Gente · Grupo ETUS</div>
        </div>
      </div>
    </div>
  )
}

type Fase = 'antes' | 'aberto' | 'aguardando' | 'encerrado' | 'cancelado'

function computeFase(s: Sorteio | null, now: number): Fase {
  if (!s) return 'antes'
  if (s.status === 'cancelado') return 'cancelado'
  if (s.status === 'sorteado') return 'encerrado'
  const nowTs = now
  const inicio = tsToMs(s.janelaSorteioInicio)
  const fim = tsToMs(s.janelaSorteioFim)
  if (inicio == null || fim == null) return 'antes'
  // Inscrições: até o momento em que abre a janela de sorteio.
  if (nowTs < inicio) return 'aberto'
  // Janela de sorteio aberta, mas RH ainda não sorteou → aguardando.
  if (nowTs >= inicio && nowTs <= fim) return 'aguardando'
  // Janela fechou e RH não sorteou → trata como encerrado.
  return 'encerrado'
}

function tsToMs(ts: Timestamp | undefined): number | null {
  if (!ts) return null
  try {
    return ts.toMillis()
  } catch {
    return null
  }
}

function fmtDate(ts: Timestamp): string {
  try {
    return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return '—'
  }
}

function fmtTime(ts: Timestamp): string {
  try {
    return ts.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function fmtDateTime(ts: Timestamp): string {
  try {
    const d = ts.toDate()
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function traduzirErro(msg: string): string {
  if (msg.includes('auth/popup-closed-by-user')) return 'Login com Google cancelado.'
  if (msg.includes('auth/popup-blocked')) return 'Pop-up bloqueado pelo navegador. Permita pop-ups pra esse site.'
  if (msg.includes('auth/operation-not-allowed')) return 'Login com Google não está habilitado no Firebase Console.'
  if (msg.includes('auth/unauthorized-domain')) return 'Domínio não autorizado no Firebase Auth.'
  if (msg.includes('auth/network-request-failed')) return 'Falha de conexão. Verifique sua internet.'
  return msg
}

interface AcaoProps {
  fase: Fase
  sorteio: Sorteio
  user: User | null
  inscrito: boolean | null
  googleLoading: boolean
  onGoogle: () => void
  onInscrever: () => void
  onSair: () => void
}

function SorteioAcao({ fase, sorteio, user, inscrito, googleLoading, onGoogle, onInscrever, onSair }: AcaoProps) {
  if (fase === 'cancelado') {
    return (
      <div className="sp-state sp-bad">
        <div className="sp-state-title">Sorteio cancelado</div>
        <div className="sp-state-sub">Esse sorteio foi cancelado pela organização.</div>
      </div>
    )
  }

  if (fase === 'encerrado') {
    if (sorteio.status === 'sorteado') {
      return (
        <div className="sp-state sp-ok">
          <div className="sp-state-title">Sorteio encerrado</div>
          <div className="sp-state-sub">
            {sorteio.vencedorNome
              ? `Vencedor(a): ${sorteio.vencedorNome}`
              : 'Resultado indisponível.'}
          </div>
        </div>
      )
    }
    return (
      <div className="sp-state sp-muted">
        <div className="sp-state-title">Inscrições encerradas</div>
        <div className="sp-state-sub">O sorteio já foi realizado ou o prazo expirou.</div>
      </div>
    )
  }

  if (fase === 'aguardando') {
    return (
      <div className="sp-state sp-muted">
        <div className="sp-state-title">Inscrições encerradas</div>
        <div className="sp-state-sub">
          Estamos na janela do sorteio. Aguarde o anúncio do vencedor.
        </div>
      </div>
    )
  }

  // fase === 'aberto'
  if (!user) {
    return (
      <div className="sp-cta">
        <button className="btn btn-primary btn-google sp-btn" type="button" onClick={onGoogle} disabled={googleLoading}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3c-2 1.5-4.5 2.5-7.3 2.5-5.3 0-9.7-3.4-11.3-8l-6.5 5c3.3 6.4 10 10.9 17.8 10.9z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.5l6.3 5.3C41.2 36.3 45 30.7 45 24c0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          {googleLoading ? 'Entrando…' : 'Entrar com Google e participar'}
        </button>
        <div className="sp-cta-hint">Seu e-mail corporativo será usado apenas pra garantir uma inscrição por pessoa.</div>
      </div>
    )
  }

  if (inscrito) {
    return (
      <div className="sp-state sp-ok">
        <div className="sp-state-title">Inscrição confirmada ✓</div>
        <div className="sp-state-sub">
          Sua inscrição como <b>{user.displayName ?? user.email}</b> está registrada.
          Boa sorte!
        </div>
        <button type="button" className="tbtn sp-link" onClick={onSair}>
          Sair dessa conta
        </button>
      </div>
    )
  }

  return (
    <div className="sp-cta">
      <div className="sp-who">
        Você está logado como <b>{user.displayName ?? user.email}</b>.
      </div>
      <button className="btn btn-primary sp-btn" type="button" onClick={onInscrever} disabled={googleLoading}>
        {googleLoading ? 'Inscrevendo…' : 'Confirmar inscrição'}
      </button>
      <button type="button" className="tbtn sp-link" onClick={onSair}>
        Trocar de conta
      </button>
    </div>
  )
}
