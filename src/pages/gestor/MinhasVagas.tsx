import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import StatusBadge from '../../components/StatusBadge'
import type { Vaga, VagaStatus } from '../../types'
import { getVagaEmpresas, STATUS_LABELS, STATUS_ORDER } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

export default function GestorMinhasVagas() {
  const { profile } = useAuth()
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VagaStatus | 'todas'>('todas')

  useEffect(() => {
    if (!profile) return
    const q = query(collection(db, 'vagas'), where('gestorUid', '==', profile.uid))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) }))
      list.sort((a, b) => {
        const at = a.createdAt?.toMillis?.() ?? 0
        const bt = b.createdAt?.toMillis?.() ?? 0
        return bt - at
      })
      setVagas(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [profile])

  const filtered = useMemo(() => {
    return vagas.filter((v) => {
      if (statusFilter !== 'todas' && v.status !== statusFilter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!v.cargo.toLowerCase().includes(s) && !v.time.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [vagas, search, statusFilter])

  const kpis = useMemo(() => {
    const total = vagas.length
    const emAnd = vagas.filter(v => ['aberta','triagem','entrevistas','proposta'].includes(v.status)).length
    const contratadas = vagas.filter(v => v.status === 'contratada').length
    return { total, emAnd, contratadas }
  }, [vagas])

  return (
    <>
      <Topbar
        title="Minhas vagas"
        icon="◱"
        actions={
          <Link to="/gestor/nova" className="tbtn pri">＋ Abrir nova vaga</Link>
        }
      />
      <div className="content">
        <div className="krow k3">
          <KpiCard label="Total de vagas" value={kpis.total} icon="◱" tone="g" meta="Que você já abriu" />
          <KpiCard label="Em andamento" value={kpis.emAnd} icon="⧗" tone="b" meta="Ativas no processo" />
          <KpiCard label="Contratadas" value={kpis.contratadas} icon="✓" tone="g" meta="Concluídas com sucesso" />
        </div>

        <div className="panel">
          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input
                className="srch"
                placeholder="Buscar por cargo ou time…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as VagaStatus | 'todas')}>
              <option value="todas">Todos os status</option>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◱</div>
              <div className="empty-ttl">Nenhuma vaga encontrada</div>
              <div className="empty-sub">
                {vagas.length === 0
                  ? 'Comece abrindo sua primeira vaga.'
                  : 'Ajuste os filtros para ver resultados.'}
              </div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Cargo</th>
                    <th>Time</th>
                    <th>Empresa</th>
                    <th>Status</th>
                    <th>Aberta em</th>
                    <th style={{ width: 80 }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.id}>
                      <td><div className="tdm">{v.cargo}</div></td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{v.time}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{getVagaEmpresas(v).join(' · ') || '—'}</td>
                      <td><StatusBadge status={v.status} /></td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(v.createdAt)}</td>
                      <td>
                        <Link to={`/gestor/vagas/${v.id}`} className="tbtn" style={{ height: 26 }}>
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
