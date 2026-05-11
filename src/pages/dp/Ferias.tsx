import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  collection, doc, onSnapshot, query, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { FeriasRequest } from '../../types'

// Painel do RH para aprovar/recusar pedidos de férias abertos pelos
// colaboradores CLT no /me.

function fmtDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function fmtDateTime(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try {
    return ts.toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

const STATUS_LABEL: Record<FeriasRequest['status'], string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
}

const STATUS_BDG: Record<FeriasRequest['status'], string> = {
  pendente: 'warn',
  aprovada: 'ok',
  recusada: 'bad',
  cancelada: 'gray',
}

export default function Ferias() {
  const [items, setItems] = useState<FeriasRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState<'todas' | FeriasRequest['status']>('todas')
  const [edit, setEdit] = useState<FeriasRequest | null>(null)

  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'ferias')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<FeriasRequest, 'id'>) }))
      list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return u
  }, [])

  const filtered = useMemo(() => {
    return items.filter(f => statusF === 'todas' || f.status === statusF)
  }, [items, statusF])

  const kpis = useMemo(() => ({
    total: items.length,
    pendentes: items.filter(f => f.status === 'pendente').length,
    aprovadas: items.filter(f => f.status === 'aprovada').length,
    recusadas: items.filter(f => f.status === 'recusada').length,
  }), [items])

  return (
    <>
      <Topbar title="Férias" icon="☀" />
      <div className="content">
        <div className="krow k4">
          <KpiCard label="Total" value={kpis.total} icon="☀" tone="b" />
          <KpiCard
            label="Aguardando aprovação"
            value={kpis.pendentes}
            icon="⏱"
            tone={kpis.pendentes > 0 ? 'r' : 'g'}
          />
          <KpiCard label="Aprovadas" value={kpis.aprovadas} icon="✓" tone="g" />
          <KpiCard label="Recusadas" value={kpis.recusadas} icon="✕" tone="a" />
        </div>

        <div className="panel">
          <div className="ph">
            <div className="pt">Pedidos de férias</div>
            <div style={{ fontSize: 11, color: 'var(--mut)' }}>
              Colaboradores CLT abrem pelo próprio perfil (/me). RH aprova ou
              recusa por aqui.
            </div>
          </div>
          <div className="filter-bar">
            <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
              <option value="todas">Todos os status</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovada">Aprovadas</option>
              <option value="recusada">Recusadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">☀</div>
              <div className="empty-ttl">Nenhum pedido</div>
              <div className="empty-sub">Os pedidos aparecem aqui quando um colaborador abre pelo /me.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Período</th>
                    <th>Dias</th>
                    <th>Aberto em</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id}>
                      <td>
                        <Link
                          to={`/dp/colaboradores/${f.colaboradorId}`}
                          className="tdm"
                          style={{ textDecoration: 'none', color: 'var(--fg)' }}
                        >
                          {f.colaboradorNome}
                        </Link>
                        <div className="tds" style={{ fontSize: 11, color: 'var(--mut)' }}>
                          {f.colaboradorEmail}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {fmtDate(f.inicio)} → {fmtDate(f.fim)}
                      </td>
                      <td style={{ fontSize: 12 }}>{f.dias}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDateTime(f.criadoEm)}</td>
                      <td>
                        <span className={`bdg ${STATUS_BDG[f.status]}`}>{STATUS_LABEL[f.status]}</span>
                      </td>
                      <td>
                        <button type="button" className="tbtn" onClick={() => setEdit(f)} style={{ height: 26 }}>
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {edit && <FeriasModal f={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function FeriasModal({ f, onClose }: { f: FeriasRequest; onClose: () => void }) {
  const { profile } = useAuth()
  const [resposta, setResposta] = useState(f.respostaRh ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function aprovar() {
    if (!profile) return
    setSaving(true); setErr(null)
    try {
      await updateDoc(doc(db, 'ferias', f.id), {
        status: 'aprovada',
        respostaRh: resposta || null,
        resolvidoPorUid: profile.uid,
        resolvidoPorNome: profile.name,
        resolvidoEm: serverTimestamp(),
      })
      // Marca o colaborador como em férias (status visual no DP).
      try {
        await updateDoc(doc(db, 'colaboradores', f.colaboradorId), {
          status: 'ferias',
          updatedAt: serverTimestamp(),
        })
      } catch { /* rule pode bloquear; pedido fica aprovado mesmo assim */ }
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao aprovar.')
    } finally { setSaving(false) }
  }

  async function recusar(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (resposta.trim().length < 3) { setErr('Escreva uma justificativa antes de recusar.'); return }
    setSaving(true); setErr(null)
    try {
      await updateDoc(doc(db, 'ferias', f.id), {
        status: 'recusada',
        respostaRh: resposta.trim(),
        resolvidoPorUid: profile.uid,
        resolvidoPorNome: profile.name,
        resolvidoEm: serverTimestamp(),
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao recusar.')
    } finally { setSaving(false) }
  }

  async function cancelar() {
    if (!confirm('Cancelar esse pedido de férias?')) return
    if (!profile) return
    setSaving(true); setErr(null)
    try {
      await updateDoc(doc(db, 'ferias', f.id), {
        status: 'cancelada',
        respostaRh: resposta || null,
        resolvidoPorUid: profile.uid,
        resolvidoPorNome: profile.name,
        resolvidoEm: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao cancelar.')
    } finally { setSaving(false) }
  }

  const podeResolver = f.status === 'pendente'
  const podeCancelar = f.status !== 'cancelada' && f.status !== 'recusada'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Férias — {f.colaboradorNome}</h2>
        <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>
          {fmtDate(f.inicio)} → {fmtDate(f.fim)} · {f.dias} dia(s)
        </div>
        {err && <div className="error-text">{err}</div>}
        {f.observacoes && (
          <div style={{ background: 'var(--card2)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
            <b>Observações do colaborador:</b><br />{f.observacoes}
          </div>
        )}

        <form onSubmit={recusar} className="row-gap-14">
          <div className="field">
            <label>Resposta do RH</label>
            <textarea
              rows={3}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Aprovação ou justificativa de recusa."
            />
          </div>
          <div className="hstack" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Fechar
            </button>
            <div className="hstack" style={{ gap: 8 }}>
              {podeCancelar && (
                <button type="button" className="btn" onClick={cancelar} disabled={saving} style={{ color: 'var(--bad)' }}>
                  Cancelar
                </button>
              )}
              {podeResolver && (
                <>
                  <button type="submit" className="btn" disabled={saving} style={{ color: 'var(--bad)' }}>
                    Recusar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={aprovar} disabled={saving}>
                    {saving ? 'Aprovando…' : 'Aprovar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
