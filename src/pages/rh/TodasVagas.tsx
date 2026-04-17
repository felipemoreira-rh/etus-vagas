import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '../../firebase'
import StatusBadge from '../../components/StatusBadge'
import type { Vaga, VagaStatus } from '../../types'

export default function TodasVagas() {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<VagaStatus | 'all'>('all')
  const [empresa, setEmpresa] = useState<string>('all')

  useEffect(() => {
    const q = query(collection(db, 'vagas'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setVagas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) })))
      setLoading(false)
    })
    return unsub
  }, [])

  const empresas = useMemo(() => {
    const set = new Set<string>()
    vagas.forEach((v) => v.empresa && set.add(v.empresa))
    return Array.from(set).sort()
  }, [vagas])

  const filtradas = useMemo(() => {
    return vagas.filter((v) => {
      if (status !== 'all' && v.status !== status) return false
      if (empresa !== 'all' && v.empresa !== empresa) return false
      if (busca) {
        const hay = `${v.cargo} ${v.time} ${v.gestorNome} ${v.empresa}`.toLowerCase()
        if (!hay.includes(busca.toLowerCase())) return false
      }
      return true
    })
  }, [vagas, status, empresa, busca])

  function exportarCsv() {
    const header = [
      'ID',
      'Cargo',
      'Empresa',
      'Time',
      'Status',
      'Regime',
      'Nível',
      'Gestor',
      'E-mail Gestor',
      'Aberta em',
    ]
    const rows = filtradas.map((v) => [
      v.id,
      v.cargo,
      v.empresa,
      v.time,
      v.status,
      v.regime,
      v.nivel,
      v.gestorNome,
      v.gestorEmail,
      formatarData(v.createdAt),
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vagas-etus-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Todas as vagas</h1>
          <p>Gerencie, movimente status e exporte os dados.</p>
        </div>
        <button className="btn btn-secondary" onClick={exportarCsv}>
          Exportar CSV
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Buscar por cargo, gestor, time…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 260 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as VagaStatus | 'all')}>
          <option value="all">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="triagem">Triagem</option>
          <option value="entrevistas">Entrevistas</option>
          <option value="proposta">Proposta</option>
          <option value="contratada">Contratada</option>
          <option value="pausada">Pausada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="all">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cargo</th>
              <th>Empresa</th>
              <th>Time</th>
              <th>Gestor</th>
              <th>Regime</th>
              <th>Status</th>
              <th>Aberta em</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  Carregando…
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  Nenhuma vaga encontrada.
                </td>
              </tr>
            ) : (
              filtradas.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.cargo}</td>
                  <td>{v.empresa}</td>
                  <td>{v.time}</td>
                  <td>{v.gestorNome}</td>
                  <td>{v.regime}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>{formatarData(v.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/rh/vagas/${v.id}`}
                      className="btn btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      Abrir
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
