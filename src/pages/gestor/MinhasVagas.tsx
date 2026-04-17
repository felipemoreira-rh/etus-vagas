import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../../components/StatusBadge'
import type { Vaga, VagaStatus } from '../../types'

export default function MinhasVagas() {
  const { user } = useAuth()
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<VagaStatus | 'all'>('all')

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'vagas'),
      where('gestorUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setVagas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) })))
        setLoading(false)
      },
      (err) => {
         
        console.error(err)
        setLoading(false)
      },
    )
    return unsub
  }, [user])

  const filtradas = useMemo(() => {
    return vagas.filter((v) => {
      if (filtroStatus !== 'all' && v.status !== filtroStatus) return false
      if (busca && !`${v.cargo} ${v.time}`.toLowerCase().includes(busca.toLowerCase()))
        return false
      return true
    })
  }, [vagas, filtroStatus, busca])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Minhas vagas</h1>
          <p>Acompanhe o andamento das vagas que você abriu.</p>
        </div>
        <Link to="/gestor/nova" className="btn btn-primary">
          + Abrir nova vaga
        </Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi accent">
          <div className="label">Total</div>
          <div className="value">{vagas.length}</div>
        </div>
        <div className="kpi">
          <div className="label">Em andamento</div>
          <div className="value">
            {vagas.filter((v) => !['contratada', 'cancelada'].includes(v.status)).length}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Contratadas</div>
          <div className="value">{vagas.filter((v) => v.status === 'contratada').length}</div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Buscar por cargo ou time…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as VagaStatus | 'all')}
        >
          <option value="all">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="triagem">Triagem</option>
          <option value="entrevistas">Entrevistas</option>
          <option value="proposta">Proposta</option>
          <option value="contratada">Contratada</option>
          <option value="pausada">Pausada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cargo</th>
              <th>Time</th>
              <th>Empresa</th>
              <th>Status</th>
              <th>Aberta em</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Carregando…
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Nenhuma vaga encontrada. <Link to="/gestor/nova">Abrir a primeira.</Link>
                </td>
              </tr>
            ) : (
              filtradas.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.cargo}</td>
                  <td>{v.time}</td>
                  <td>{v.empresa}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>{formatarData(v.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/gestor/vagas/${v.id}`} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }}>
                      Detalhes
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function formatarData(ts: unknown): string {
  if (!ts) return '—'
  try {
    const d =
      typeof ts === 'object' && ts !== null && 'toDate' in ts
        ? (ts as { toDate: () => Date }).toDate()
        : new Date(ts as string | number)
    return d.toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}
