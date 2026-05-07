import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection, doc, onSnapshot, runTransaction, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Sorteio, SorteioParticipante, SorteioStatus } from '../../types'
import { SORTEIO_STATUS_LABEL } from '../../types'

export default function SorteioDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [sorteio, setSorteio] = useState<Sorteio | null>(null)
  const [participantes, setParticipantes] = useState<SorteioParticipante[]>([])
  const [loadingS, setLoadingS] = useState(true)
  const [loadingP, setLoadingP] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [action, setAction] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'sorteios', id), (snap) => {
      if (!snap.exists()) {
        setSorteio(null)
      } else {
        setSorteio({ id: snap.id, ...(snap.data() as Omit<Sorteio, 'id'>) })
      }
      setLoadingS(false)
    }, () => setLoadingS(false))
    return unsub
  }, [id])

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(collection(db, 'sorteios', id, 'participantes'), (snap) => {
      const list = snap.docs.map(d => d.data() as SorteioParticipante)
      list.sort((a, b) => (a.inscritoEm?.toMillis?.() ?? 0) - (b.inscritoEm?.toMillis?.() ?? 0))
      setParticipantes(list)
      setLoadingP(false)
    }, () => setLoadingP(false))
    return unsub
  }, [id])

  const publicUrl = useMemo(() => {
    if (!id) return ''
    return `${window.location.origin}/sorteio/${id}`
  }, [id])

  // Se as inscrições "venceram" (janela do sorteio abriu) mas o status
  // ainda não foi atualizado no Firestore, o RH vê isso aqui e pode
  // fechar inscrições explicitamente (ou o botão "Sortear" já faz isso
  // dentro da transaction quando clicado).
  const deveFechar = useMemo(() => {
    if (!sorteio) return false
    if (sorteio.status !== 'inscricoes_abertas') return false
    const inicio = sorteio.janelaSorteioInicio?.toMillis?.() ?? 0
    return now >= inicio
  }, [sorteio, now])

  const podeSortear = useMemo(() => {
    if (!sorteio) return false
    if (sorteio.status === 'sorteado' || sorteio.status === 'cancelado') return false
    const inicio = sorteio.janelaSorteioInicio?.toMillis?.() ?? 0
    const fim = sorteio.janelaSorteioFim?.toMillis?.() ?? 0
    return now >= inicio && now <= fim && participantes.length > 0
  }, [sorteio, now, participantes])

  async function handleCopiarLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setAction('Link copiado ✓')
      setTimeout(() => setAction(null), 2000)
    } catch {
      setAction('Não consegui copiar. Copie manualmente.')
    }
  }

  async function handleFecharInscricoes() {
    if (!id || !sorteio) return
    if (!confirm('Fechar inscrições agora? Essa ação pode ser revertida reabrindo o sorteio até a hora do sorteio começar.')) return
    try {
      await updateDoc(doc(db, 'sorteios', id), { status: 'aguardando_sorteio' as SorteioStatus })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao fechar inscrições.')
    }
  }

  async function handleReabrirInscricoes() {
    if (!id || !sorteio) return
    const inicio = sorteio.janelaSorteioInicio?.toMillis?.() ?? 0
    if (Date.now() >= inicio) {
      alert('Não é possível reabrir — a janela do sorteio já começou.')
      return
    }
    try {
      await updateDoc(doc(db, 'sorteios', id), { status: 'inscricoes_abertas' as SorteioStatus })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao reabrir.')
    }
  }

  async function handleSortear() {
    if (!id || !sorteio || !profile) return
    if (participantes.length === 0) {
      alert('Nenhum inscrito pra sortear.')
      return
    }
    if (!confirm(`Sortear agora entre ${participantes.length} inscrito(s)?\n\nO vencedor é definitivo e todo mundo no sistema passa a ver o resultado.`)) return

    setDrawing(true)
    try {
      // Sorteio uniforme via crypto.getRandomValues + runTransaction pra
      // garantir atomicidade (quem ler depois vê vencedor + status ao
      // mesmo tempo e não consegue "sortear duas vezes" por mistake).
      const rand = new Uint32Array(1)
      crypto.getRandomValues(rand)
      const idx = rand[0] % participantes.length
      const vencedor = participantes[idx]

      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'sorteios', id)
        const snap = await tx.get(ref)
        if (!snap.exists()) throw new Error('Sorteio não existe mais.')
        const data = snap.data() as Sorteio
        if (data.status === 'sorteado') throw new Error('Esse sorteio já foi sorteado.')
        if (data.status === 'cancelado') throw new Error('Esse sorteio foi cancelado.')
        tx.update(ref, {
          status: 'sorteado' as SorteioStatus,
          vencedorUid: vencedor.uid,
          vencedorNome: vencedor.nome,
          vencedorEmail: vencedor.email,
          sorteadoEm: serverTimestamp(),
          sorteadoPorUid: profile.uid,
          sorteadoPorNome: profile.name,
          totalInscritos: participantes.length,
        })
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao sortear.')
    } finally {
      setDrawing(false)
    }
  }

  async function handleCancelar() {
    if (!id || !sorteio) return
    if (!confirm(`Cancelar o sorteio "${sorteio.titulo}"?\n\nO sorteio deixa de aceitar inscrições e aparece como cancelado na página pública.`)) return
    try {
      await updateDoc(doc(db, 'sorteios', id), { status: 'cancelado' as SorteioStatus })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao cancelar.')
    }
  }

  if (loadingS) return <div className="content"><div className="empty-state">Carregando…</div></div>
  if (!sorteio) return (
    <div className="content">
      <div className="empty-state">Sorteio não encontrado.</div>
      <div className="hstack" style={{ justifyContent: 'center', marginTop: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/rh/sorteios')}>Voltar</button>
      </div>
    </div>
  )

  return (
    <>
      <Topbar
        title={sorteio.titulo}
        icon="🎁"
        actions={
          <div className="hstack" style={{ gap: 6 }}>
            <button type="button" className="tbtn" onClick={() => navigate('/rh/sorteios')}>← Voltar</button>
          </div>
        }
      />
      <div className="content">
        <div className="panel">
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ marginTop: 0 }}>{sorteio.titulo}</h3>
              {sorteio.descricao && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sorteio.descricao}</p>}
              <div style={{ fontSize: 12, marginTop: 6 }}><b>Prêmio:</b> {sorteio.premio}</div>
              {sorteio.dataEvento && (
                <div style={{ fontSize: 12, marginTop: 2 }}><b>Data do evento:</b> {fmtDate(sorteio.dataEvento)}</div>
              )}
              <div style={{ fontSize: 12, marginTop: 2 }}>
                <b>Janela do sorteio:</b> {fmtDateTime(sorteio.janelaSorteioInicio)} – {fmtTime(sorteio.janelaSorteioFim)}
              </div>
              <div style={{ marginTop: 8 }}>
                <SorteioStatusBadge status={sorteio.status} />
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 12, padding: 12, background: 'rgba(141, 247, 104, 0.06)' }}>
            <div className="sm-lbl">Link público do sorteio</div>
            <div className="hstack" style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
              <code style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{publicUrl}</code>
              <button type="button" className="tbtn" onClick={handleCopiarLink}>Copiar</button>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="tbtn">Abrir ↗</a>
            </div>
            {action && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{action}</div>}
          </div>

          <div className="hstack" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {sorteio.status === 'inscricoes_abertas' && (
              <button type="button" className="btn btn-ghost" onClick={handleFecharInscricoes}>
                Fechar inscrições
              </button>
            )}
            {sorteio.status === 'aguardando_sorteio' && !deveFechar && (
              <button type="button" className="btn btn-ghost" onClick={handleReabrirInscricoes}>
                Reabrir inscrições
              </button>
            )}
            {(sorteio.status === 'inscricoes_abertas' || sorteio.status === 'aguardando_sorteio') && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSortear}
                  disabled={!podeSortear || drawing}
                  title={
                    podeSortear ? 'Sortear agora' :
                    participantes.length === 0 ? 'Nenhum inscrito pra sortear' :
                    'Fora da janela configurada pro sorteio'
                  }
                >
                  {drawing ? 'Sorteando…' : '🎲 Sortear agora'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleCancelar} style={{ color: 'var(--bad)' }}>
                  Cancelar sorteio
                </button>
              </>
            )}
          </div>

          {!podeSortear && (sorteio.status === 'inscricoes_abertas' || sorteio.status === 'aguardando_sorteio') && (
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              {participantes.length === 0
                ? 'Botão "Sortear" fica disponível quando houver pelo menos 1 inscrito e a janela do sorteio estiver aberta.'
                : `Botão "Sortear" ficará disponível entre ${fmtDateTime(sorteio.janelaSorteioInicio)} e ${fmtTime(sorteio.janelaSorteioFim)}.`
              }
            </div>
          )}
        </div>

        {sorteio.status === 'sorteado' && (
          <div className="panel" style={{ background: 'rgba(59, 228, 118, 0.08)' }}>
            <h3 style={{ marginTop: 0 }}>🏆 Vencedor(a)</h3>
            <div style={{ fontSize: 14 }}><b>{sorteio.vencedorNome}</b></div>
            {sorteio.vencedorEmail && <div className="muted" style={{ fontSize: 12 }}>{sorteio.vencedorEmail}</div>}
            {sorteio.sorteadoEm && (
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                Sorteado em {fmtDateTime(sorteio.sorteadoEm)} por {sorteio.sorteadoPorNome ?? '—'}
              </div>
            )}
          </div>
        )}

        <div className="panel">
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 style={{ margin: 0 }}>Inscritos</h3>
            <span className="muted" style={{ fontSize: 12 }}>{participantes.length} pessoa(s)</span>
          </div>
          {loadingP ? (
            <div className="empty-state">Carregando…</div>
          ) : participantes.length === 0 ? (
            <div className="empty-state">
              Nenhuma inscrição ainda. Compartilhe o link público pra começar a receber inscrições.
            </div>
          ) : (
            <table style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Inscrito em</th>
                </tr>
              </thead>
              <tbody>
                {participantes.map((p, i) => {
                  const isVencedor = sorteio.vencedorUid === p.uid
                  return (
                    <tr key={p.uid} style={isVencedor ? { background: 'rgba(59, 228, 118, 0.08)' } : undefined}>
                      <td style={{ fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div className="tdm">{p.nome}</div>
                        {isVencedor && <div style={{ fontSize: 11, color: 'var(--ok)' }}>🏆 Vencedor(a)</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{p.email}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>
                        {p.inscritoEm ? fmtDateTime(p.inscritoEm) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

function SorteioStatusBadge({ status }: { status: SorteioStatus }) {
  const cls =
    status === 'sorteado' ? 'ok'
    : status === 'cancelado' ? 'bad'
    : status === 'aguardando_sorteio' ? 'warn'
    : status === 'inscricoes_abertas' ? 'info'
    : 'muted'
  return <span className={`bdg ${cls}`}>{SORTEIO_STATUS_LABEL[status]}</span>
}

function fmtDate(ts: Timestamp): string {
  try { return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return '—' }
}
function fmtTime(ts: Timestamp): string {
  try { return ts.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}
function fmtDateTime(ts: Timestamp): string {
  try {
    const d = ts.toDate()
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}
