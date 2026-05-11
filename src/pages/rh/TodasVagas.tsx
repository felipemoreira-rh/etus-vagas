import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, deleteDoc, doc, onSnapshot, query } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import StatusBadge from '../../components/StatusBadge'
import type { Vaga, VagaStatus } from '../../types'
import { getVagaEmpresas, STATUS_FINALIZADOS, STATUS_LABELS, STATUS_ORDER } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function daysSince(ts?: { toDate: () => Date } | null) {
  if (!ts) return 0
  try {
    const d = ts.toDate()
    return Math.floor((Date.now() - d.getTime()) / 86400000)
  } catch { return 0 }
}

// Quantos dias a vaga ficou em aberto. Se já está finalizada/cancelada,
// usa o valor congelado em `diasAberta` (gravado quando a vaga foi fechada).
// Se for legado (finalizada mas sem `diasAberta`), tenta inferir da data
// de fechamento; só cai no createdAt → hoje pra vagas ativas.
function diasEmAberto(v: Vaga) {
  const isFinal = STATUS_FINALIZADOS.includes(v.status)
  if (isFinal) {
    if (typeof v.diasAberta === 'number') return v.diasAberta
    if (v.dataFechamento && v.createdAt) {
      try {
        const ini = v.createdAt.toDate().getTime()
        const fim = v.dataFechamento.toDate().getTime()
        return Math.max(0, Math.floor((fim - ini) / 86400000))
      } catch { /* fallthrough */ }
    }
    // Vaga finalizada legado sem nenhum dos dois → não conseguimos saber
    // o SLA real; mostra travessão pra não enganar com contagem viva.
    return null
  }
  return daysSince(v.createdAt)
}

function toCsv(rows: Vaga[]) {
  const header = ['ID','Cargo','Time','Empresas','Status','Gestor','Email do gestor','Regime','Nível','Jornada','Aberta em','Fechada em','Dias em aberto']
  const body = rows.map(v => {
    const dias = diasEmAberto(v)
    return [
      v.id, v.cargo, v.time, getVagaEmpresas(v).join(' / '), STATUS_LABELS[v.status],
      v.gestorNome, v.gestorEmail, v.regime, v.nivel, v.jornada,
      formatDate(v.createdAt), formatDate(v.dataFechamento),
      dias == null ? '' : String(dias),
    ].map(cell => '"' + String(cell ?? '').replace(/"/g, '""') + '"').join(',')
  })
  return [header.join(','), ...body].join('\n')
}

export default function TodasVagas() {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VagaStatus | 'todas'>('todas')
  const [empresaFilter, setEmpresaFilter] = useState<string>('todas')

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'vagas')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setVagas(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const empresas = useMemo(() => {
    const s = new Set<string>()
    vagas.forEach(v => getVagaEmpresas(v).forEach(e => s.add(e)))
    return [...s].sort()
  }, [vagas])

  const filtered = useMemo(() => {
    return vagas.filter(v => {
      if (statusFilter !== 'todas' && v.status !== statusFilter) return false
      // Multi-empresa: vaga aparece se a empresa filtrada estiver entre as
      // empresas marcadas (ou se a vaga legada tem `empresa` igual ao filtro).
      if (empresaFilter !== 'todas' && !getVagaEmpresas(v).includes(empresaFilter)) return false
      if (search) {
        const s = search.toLowerCase()
        if (!(v.cargo.toLowerCase().includes(s) ||
              v.time.toLowerCase().includes(s) ||
              v.gestorNome.toLowerCase().includes(s))) return false
      }
      return true
    })
  }, [vagas, search, statusFilter, empresaFilter])

  function exportCsv() {
    const csv = toCsv(filtered)
    // Prepend UTF-8 BOM pra Excel detectar o encoding corretamente em Windows
    // (sem isso, caracteres PT-BR como "ã", "ç", "é" viram mojibake).
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vagas-etus-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function excluirVaga(v: Vaga) {
    const txt = `Excluir a vaga "${v.cargo}"?\n\nEssa ação é permanente.`
    if (!confirm(txt)) return
    try {
      await deleteDoc(doc(db, 'vagas', v.id))
    } catch (e) {
      alert('Erro ao excluir: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <>
      <Topbar
        title="Vagas"
        icon="◱"
        actions={
          <>
            <button className="tbtn" onClick={exportCsv}>⬇ CSV</button>
            <Link to="/rh/vagas/nova" className="tbtn pri">＋ Nova vaga</Link>
          </>
        }
      />
      <div className="content">
        <div className="panel">
          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input
                className="srch"
                placeholder="Buscar por cargo, time ou gestor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as VagaStatus | 'todas')}>
              <option value="todas">Todos os status</option>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)}>
              <option value="todas">Todas as empresas</option>
              {empresas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◱</div>
              <div className="empty-ttl">Nenhuma vaga encontrada</div>
              <div className="empty-sub">Ajuste os filtros para ver resultados.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Cargo</th>
                    <th>Time</th>
                    <th>Empresa</th>
                    <th>Gestor</th>
                    <th>Status</th>
                    <th>Aberta em</th>
                    <th>Fechada em</th>
                    <th style={{ textAlign: 'right' }}>Dias</th>
                    <th style={{ width: 140 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.id}>
                      <td><div className="tdm">{v.cargo}</div></td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{v.time}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{getVagaEmpresas(v).join(' · ') || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{v.gestorNome}</td>
                      <td><StatusBadge status={v.status} /></td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(v.createdAt)}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>
                        {STATUS_FINALIZADOS.includes(v.status) ? formatDate(v.dataFechamento) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700 }}>
                        {(() => {
                          const d = diasEmAberto(v)
                          return d == null ? '—' : d
                        })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <Link to={`/rh/vagas/${v.id}`} className="tbtn" style={{ height: 26 }}>Abrir</Link>
                          <button
                            type="button"
                            onClick={() => excluirVaga(v)}
                            className="tbtn"
                            style={{ height: 26, color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
                            title="Excluir vaga"
                          >
                            ✕
                          </button>
                        </div>
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
