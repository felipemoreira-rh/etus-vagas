import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  arrayUnion, doc, onSnapshot, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import StatusBadge from '../../components/StatusBadge'
import VagaDetalheView from '../shared/VagaDetalheView'
import type { Vaga, VagaMovimentacao, VagaStatus } from '../../types'
import { STATUS_LABELS, STATUS_ORDER } from '../../types'

export default function GestorVagaDetalhe() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [novoStatus, setNovoStatus] = useState<VagaStatus>('aberta')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'vagas', id),
      (snap) => {
        if (!snap.exists()) setErr('Vaga não encontrada.')
        else {
          const v = { id: snap.id, ...(snap.data() as Omit<Vaga, 'id'>) }
          setVaga(v)
          setNovoStatus(v.status)
        }
        setLoading(false)
      },
      (e) => { setErr(e.message); setLoading(false) })
    return unsub
  }, [id])

  async function movimentar(e: FormEvent) {
    e.preventDefault()
    if (!vaga || !profile) return
    setSaving(true)
    try {
      // Firestore rejeita campos com valor `undefined`, então só incluímos
      // `nota` se tiver conteúdo real.
      const mov: VagaMovimentacao = {
        at: Timestamp.now(),
        byUid: profile.uid,
        byName: profile.name,
        fromStatus: vaga.status,
        toStatus: novoStatus,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      }
      await updateDoc(doc(db, 'vagas', vaga.id), {
        status: novoStatus,
        updatedAt: serverTimestamp(),
        historico: arrayUnion(mov),
      })
      setNota('')
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Topbar
        title={vaga?.cargo || 'Detalhe da vaga'}
        icon="◱"
        actions={
          <Link to="/gestor/minhas-vagas" className="tbtn">← Voltar</Link>
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
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{vaga.empresa}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700 }}>
                    Time
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{vaga.time}</div>
                </div>
              </div>
            </div>

            <div className="panel">
              <h3>Movimentar status</h3>
              <p style={{ color: 'var(--mut)', fontSize: 12, marginBottom: 10 }}>
                Use esse painel para mover a vaga entre etapas (ex.: pausar, cancelar, marcar como contratada).
                O RH é notificado automaticamente ao abrir o detalhe.
              </p>
              <form onSubmit={movimentar} className="form-grid" style={{ alignItems: 'end' }}>
                <div className="field">
                  <label>Novo status</label>
                  <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value as VagaStatus)}>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Nota (opcional)</label>
                  <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Contexto da movimentação" />
                </div>
                <div className="field full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Salvando…' : 'Registrar movimentação'}
                  </button>
                </div>
              </form>
            </div>

            <VagaDetalheView vaga={vaga} />
          </>
        )}
      </div>
    </>
  )
}
