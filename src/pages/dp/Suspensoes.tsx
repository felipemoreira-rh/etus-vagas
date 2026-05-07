import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { Colaborador, Suspensao } from '../../types'
import { SUSPENSAO_TIPO_LABEL } from '../../types'

// Página dedicada de histórico de suspensões de contrato (RH only).
// Lê de todos os prestadores e desnormaliza pra mostrar uma tabela única.

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

interface Linha extends Suspensao {
  colaboradorId: string
  colaboradorNome: string
  cargo: string
  empresa: string
}

export default function Suspensoes() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState<'todos' | 'ativa' | 'encerrada'>('todos')
  const [tipoF, setTipoF] = useState<'todos' | Suspensao['tipo']>('todos')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'colaboradores')), (s) => {
      setColaboradores(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) })))
      setLoading(false)
    }, () => setLoading(false))
    return u
  }, [])

  const todas = useMemo<Linha[]>(() => {
    const list: Linha[] = []
    for (const c of colaboradores) {
      for (const s of (c.suspensoes || [])) {
        list.push({ ...s, colaboradorId: c.id, colaboradorNome: c.nome, cargo: c.cargo, empresa: c.empresa })
      }
    }
    list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
    return list
  }, [colaboradores])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return todas.filter(l => {
      if (statusF !== 'todos' && l.status !== statusF) return false
      if (tipoF !== 'todos' && l.tipo !== tipoF) return false
      if (s && !l.colaboradorNome.toLowerCase().includes(s) && !l.empresa.toLowerCase().includes(s) && !l.motivo.toLowerCase().includes(s)) return false
      return true
    })
  }, [todas, statusF, tipoF, search])

  const totais = useMemo(() => {
    const ativas = todas.filter(s => s.status === 'ativa').length
    const encerradas = todas.filter(s => s.status === 'encerrada').length
    return { total: todas.length, ativas, encerradas }
  }, [todas])

  return (
    <>
      <Topbar title="Histórico de Suspensões" icon="⏸" />
      <div className="content">
        <div className="krow k3">
          <KpiCard label="Total de suspensões" value={totais.total} icon="⏸" tone="b" />
          <KpiCard label="Em curso" value={totais.ativas} icon="▶" tone={totais.ativas > 0 ? 'a' : 'g'} />
          <KpiCard label="Encerradas" value={totais.encerradas} icon="✓" tone="g" />
        </div>

        <div className="panel">
          <div className="ph">
            <div className="pt">Suspensões temporárias de contrato</div>
            <div style={{ fontSize: 11, color: 'var(--mut)' }}>
              Solicitadas pelos gestores em <Link to="/gestor/equipe" style={{ color: 'var(--g600)' }}>Meu time</Link>. RH usa essa página para auditoria.
            </div>
          </div>

          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input className="srch" placeholder="Buscar por prestador, empresa ou motivo…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
              <option value="todos">Todos os status</option>
              <option value="ativa">Em curso</option>
              <option value="encerrada">Encerradas</option>
            </select>
            <select value={tipoF} onChange={(e) => setTipoF(e.target.value as typeof tipoF)}>
              <option value="todos">Todos os tipos</option>
              {Object.entries(SUSPENSAO_TIPO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-sub" style={{ padding: 14 }}>
              Nenhum registro de suspensão {todas.length === 0 ? 'cadastrado' : 'com esses filtros'}.
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Prestador</th>
                    <th>Empresa</th>
                    <th>Tipo</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Status</th>
                    <th>Solicitante</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={`${s.colaboradorId}-${s.id}`}>
                      <td>
                        <Link to={`/dp/colaboradores/${s.colaboradorId}`} className="tdm" style={{ textDecoration: 'none', color: 'var(--fg)' }}>
                          {s.colaboradorNome}
                        </Link>
                        <div className="tds">{s.cargo}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{s.empresa || '—'}</td>
                      <td style={{ fontSize: 12 }}>{SUSPENSAO_TIPO_LABEL[s.tipo]}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDate(s.inicio)}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDate(s.fim)}</td>
                      <td>
                        <span className={`bdg ${s.status === 'ativa' ? 'info' : 'gray'}`}>
                          {s.status === 'ativa' ? 'Em curso' : 'Encerrada'}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{s.solicitanteNome}</td>
                      <td style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxWidth: 280 }}>{s.motivo || '—'}</td>
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
