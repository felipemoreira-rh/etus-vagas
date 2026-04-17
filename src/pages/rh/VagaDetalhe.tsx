import { useEffect, useState, type FormEvent } from 'react'
import { arrayUnion, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Link, useParams } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../../components/StatusBadge'
import VagaDetalheView from '../shared/VagaDetalheView'
import { STATUS_LABELS, STATUS_ORDER, type Vaga, type VagaStatus } from '../../types'

export default function VagaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [loading, setLoading] = useState(true)

  const [novoStatus, setNovoStatus] = useState<VagaStatus>('aberta')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'vagas', id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...(snap.data() as Omit<Vaga, 'id'>) }
        setVaga(data)
        setNovoStatus(data.status)
      } else {
        setVaga(null)
      }
      setLoading(false)
    })
    return unsub
  }, [id])

  async function atualizarStatus(e: FormEvent) {
    e.preventDefault()
    if (!vaga || !user || !profile) return
    setSaving(true)
    setError(null)
    setFeedback(null)
    try {
      await updateDoc(doc(db, 'vagas', vaga.id), {
        status: novoStatus,
        updatedAt: serverTimestamp(),
        responsavelRhUid: user.uid,
        responsavelRhNome: profile.name,
        historico: arrayUnion({
          at: Timestamp.now(),
          byUid: user.uid,
          byName: profile.name,
          fromStatus: vaga.status,
          toStatus: novoStatus,
          nota: nota || '',
        }),
      })
      setNota('')
      setFeedback('Status atualizado com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="empty-state">Carregando…</div>
  if (!vaga) return <div className="empty-state">Vaga não encontrada.</div>

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/rh/vagas" className="muted" style={{ fontSize: 13 }}>
            ← Voltar para todas as vagas
          </Link>
          <h1 style={{ marginTop: 8 }}>{vaga.cargo}</h1>
          <p>
            {vaga.empresa} · {vaga.time} · Gestor: {vaga.gestorNome}
          </p>
        </div>
        <StatusBadge status={vaga.status} />
      </div>

      <div className="card" style={{ marginBottom: 20, background: 'var(--green-50)', borderColor: 'var(--green-100)' }}>
        <h3>Movimentar status</h3>
        {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
        {feedback && <div className="success-text" style={{ marginBottom: 10 }}>{feedback}</div>}
        <form onSubmit={atualizarStatus} className="form-grid">
          <div className="field">
            <label>Novo status</label>
            <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value as VagaStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Registrar nota (opcional)</label>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ex.: Aguardando retorno do candidato final."
            />
          </div>
          <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving || novoStatus === vaga.status && !nota}>
              {saving ? 'Salvando…' : 'Salvar movimentação'}
            </button>
          </div>
        </form>
      </div>

      <VagaDetalheView vaga={vaga} />
    </>
  )
}
