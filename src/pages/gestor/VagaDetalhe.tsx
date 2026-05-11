import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, onSnapshot, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import StatusBadge from '../../components/StatusBadge'
import VagaDetalheView from '../shared/VagaDetalheView'
import type { CancelamentoVagaSolicitacao, Vaga } from '../../types'
import { getVagaEmpresas } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try {
    return ts.toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

export default function GestorVagaDetalhe() {
  const { id } = useParams()
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [askCancel, setAskCancel] = useState(false)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'vagas', id),
      (snap) => {
        if (!snap.exists()) setErr('Vaga não encontrada.')
        else {
          const v = { id: snap.id, ...(snap.data() as Omit<Vaga, 'id'>) }
          setVaga(v)
        }
        setLoading(false)
      },
      (e) => { setErr(e.message); setLoading(false) })
    return unsub
  }, [id])

  const pedido = vaga?.cancelamentoSolicitado
  const podeSolicitar =
    !!vaga &&
    vaga.status !== 'cancelada' &&
    vaga.status !== 'contratada' &&
    (!pedido || pedido.status !== 'pendente')

  return (
    <>
      <Topbar
        title={vaga?.cargo || 'Detalhe da vaga'}
        icon="◱"
        actions={
          <>
            {podeSolicitar && (
              <button
                type="button"
                className="tbtn"
                onClick={() => setAskCancel(true)}
                style={{ color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
                title="Solicitar ao RH o cancelamento desta vaga"
              >
                ✖ Solicitar cancelamento
              </button>
            )}
            <Link to="/gestor/minhas-vagas" className="tbtn">← Voltar</Link>
          </>
        }
      />
      <div className="content">
        {loading && <div className="empty-state">Carregando…</div>}
        {err && <div className="error-text">{err}</div>}
        {vaga && (
          <>
            <div className="panel hstack" style={{ padding: 14 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>
                  Status atual
                </div>
                <StatusBadge status={vaga.status} />
              </div>
              <div className="ml-auto hstack" style={{ gap: 18 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700 }}>
                    Empresa
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{getVagaEmpresas(vaga).join(' · ') || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700 }}>
                    Time
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{vaga.time}</div>
                </div>
              </div>
            </div>

            {pedido && <CancelamentoBanner pedido={pedido} />}

            <div className="panel" style={{ background: 'var(--card2)' }}>
              <div style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.5 }}>
                A movimentação de candidatos da vaga (triagem, entrevistas, proposta,
                aprovação, contratação) é feita pelo RH. Se a vaga não for mais
                necessária, use <b>Solicitar cancelamento</b> no topo — o RH revisa,
                aprova ou recusa e te avisa pelo histórico.
              </div>
            </div>

            <VagaDetalheView vaga={vaga} />
          </>
        )}
      </div>

      {askCancel && vaga && (
        <SolicitarCancelamentoModal
          vaga={vaga}
          onClose={() => setAskCancel(false)}
        />
      )}
    </>
  )
}

function CancelamentoBanner({ pedido }: { pedido: CancelamentoVagaSolicitacao }) {
  const tone = pedido.status === 'pendente'
    ? { bg: 'var(--warn-bg, #fff8e6)', border: 'var(--warn-bd, #f0c674)', fg: 'var(--warn, #92611a)' }
    : pedido.status === 'aprovado'
      ? { bg: 'var(--bad-bg, #fdecec)', border: 'var(--bad-bd, #e0b4b4)', fg: 'var(--bad, #a33a3a)' }
      : { bg: 'var(--card2)', border: 'var(--b1)', fg: 'var(--mut)' }
  const titulo = pedido.status === 'pendente'
    ? 'Cancelamento solicitado — aguardando RH'
    : pedido.status === 'aprovado'
      ? 'Cancelamento aprovado pelo RH'
      : 'Cancelamento recusado pelo RH'
  return (
    <div
      className="panel"
      style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.fg }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        <b>Solicitado em:</b> {formatDate(pedido.solicitadoEm)} por {pedido.solicitadoPorNome}
      </div>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        <b>Motivo:</b> {pedido.motivo}
      </div>
      {pedido.status !== 'pendente' && pedido.resolvidoEm && (
        <div style={{ fontSize: 12, marginTop: 6 }}>
          <b>Resposta do RH ({formatDate(pedido.resolvidoEm)} — {pedido.resolvidoPorNome || '—'}):</b>{' '}
          {pedido.respostaRh || '—'}
        </div>
      )}
    </div>
  )
}

function SolicitarCancelamentoModal({ vaga, onClose }: { vaga: Vaga; onClose: () => void }) {
  const { profile } = useAuth()
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (motivo.trim().length < 10) {
      setErr('Descreva o motivo do cancelamento (mínimo 10 caracteres).')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const pedido: CancelamentoVagaSolicitacao = {
        motivo: motivo.trim(),
        status: 'pendente',
        solicitadoEm: Timestamp.now(),
        solicitadoPorUid: profile.uid,
        solicitadoPorNome: profile.name || profile.email || 'Gestor',
      }
      await updateDoc(doc(db, 'vagas', vaga.id), {
        cancelamentoSolicitado: pedido,
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao solicitar cancelamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h2>Solicitar cancelamento da vaga</h2>
        <p style={{ color: 'var(--mut)', fontSize: 13 }}>
          A vaga <b>{vaga.cargo}</b> fica em <i>"cancelamento solicitado"</i> até o RH aprovar ou recusar.
          Descreva o motivo abaixo — essa informação fica registrada no histórico.
        </p>
        <form onSubmit={handleSubmit} className="row-gap-10" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Motivo do cancelamento</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: a posição não será mais reposta neste trimestre por mudança de prioridades…"
              rows={4}
              required
            />
          </div>
          {err && <div className="error-text">{err}</div>}
          <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="tbtn" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enviando…' : 'Enviar pedido ao RH'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
