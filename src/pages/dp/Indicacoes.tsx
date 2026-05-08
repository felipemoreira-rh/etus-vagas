import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { Colaborador, Estagiario } from '../../types'

// Card / página dedicada às indicações: prestadores e estagiários que
// foram contratados via referrer ('indicacao'). O programa de bônus tem
// countdown de 90 dias a partir da admissão — quando completa, o RH
// libera o pagamento ao indicador.

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function diasParaBonus(adm?: Timestamp | null): number | null {
  if (!adm) return null
  try {
    const limite = adm.toDate()
    limite.setDate(limite.getDate() + 90)
    const hoje = new Date()
    return Math.ceil((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  } catch { return null }
}

interface Linha {
  id: string
  origem: 'colaborador' | 'estagiario'
  nome: string
  cargo: string
  empresa: string
  area?: string
  dataAdmissao?: Timestamp
  indicadoPorNome?: string
  status: string
  diasRestantes: number | null
  link: string
}

export default function Indicacoes() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [estagiarios, setEstagiarios] = useState<Estagiario[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'ativas' | 'liberado' | 'expirando'>('todos')

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'colaboradores')), (s) => {
      setColaboradores(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) })))
      setLoading(false)
    }, () => setLoading(false))
    const u2 = onSnapshot(query(collection(db, 'estagiarios')), (s) => {
      setEstagiarios(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Estagiario, 'id'>) })))
    })
    return () => { u1(); u2() }
  }, [])

  const linhas: Linha[] = useMemo(() => {
    const list: Linha[] = []
    for (const c of colaboradores) {
      if (!c.indicadoPorNome) continue
      list.push({
        id: c.id,
        origem: 'colaborador',
        nome: c.nome,
        cargo: c.cargo,
        empresa: c.empresa,
        area: c.area,
        dataAdmissao: c.dataAdmissao,
        indicadoPorNome: c.indicadoPorNome,
        status: c.status,
        diasRestantes: diasParaBonus(c.dataAdmissao),
        link: `/dp/colaboradores/${c.id}`,
      })
    }
    for (const e of estagiarios) {
      if (!e.indicadoPorNome) continue
      list.push({
        id: e.id,
        origem: 'estagiario',
        nome: e.nome,
        cargo: 'Estagiário',
        empresa: e.empresa,
        area: e.area,
        dataAdmissao: e.dataInicio,
        indicadoPorNome: e.indicadoPorNome,
        status: e.status,
        diasRestantes: diasParaBonus(e.dataInicio),
        link: `/dp/estagiarios`,
      })
    }
    list.sort((a, b) => (a.diasRestantes ?? 99999) - (b.diasRestantes ?? 99999))
    return list
  }, [colaboradores, estagiarios])

  const filtered = useMemo(() => {
    return linhas.filter(l => {
      if (filtro === 'ativas') return l.diasRestantes != null && l.diasRestantes > 0
      if (filtro === 'liberado') return l.diasRestantes != null && l.diasRestantes <= 0
      if (filtro === 'expirando') return l.diasRestantes != null && l.diasRestantes > 0 && l.diasRestantes <= 15
      return true
    })
  }, [linhas, filtro])

  const totais = useMemo(() => {
    const ativas = linhas.filter(l => l.diasRestantes != null && l.diasRestantes > 0).length
    const liberado = linhas.filter(l => l.diasRestantes != null && l.diasRestantes <= 0).length
    const expirando = linhas.filter(l => l.diasRestantes != null && l.diasRestantes > 0 && l.diasRestantes <= 15).length
    return { total: linhas.length, ativas, liberado, expirando }
  }, [linhas])

  return (
    <>
      <Topbar title="Indicações" icon="★" />
      <div className="content">
        <div className="krow k4">
          <KpiCard label="Total de indicações" value={totais.total} icon="★" tone="b" />
          <KpiCard label="Em curso (90d)" value={totais.ativas} icon="⏱" tone="a" />
          <KpiCard label="Bônus liberado" value={totais.liberado} icon="✓" tone="g" />
          <KpiCard label="Vencendo em ≤15d" value={totais.expirando} icon="⚠" tone={totais.expirando > 0 ? 'r' : 'g'} />
        </div>

        <div className="panel">
          <div className="ph">
            <div className="pt">
              <span className="pdot" style={{ background: 'var(--g600)' }} />
              Programa de indicação · countdown de 90 dias
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)' }}>
              O bônus do indicador é liberado quando o indicado completa 90 dias desde a admissão.
            </div>
          </div>

          <div className="filter-bar">
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
              <option value="todos">Todos</option>
              <option value="ativas">Em curso</option>
              <option value="expirando">Vencendo (≤15d)</option>
              <option value="liberado">Bônus liberado</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">★</div>
              <div className="empty-ttl">Nenhuma indicação {filtro !== 'todos' ? 'com esse filtro' : 'cadastrada'}</div>
              <div className="empty-sub">Indicações aparecem aqui automaticamente quando um candidato é contratado pela origem "Indicação".</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Indicado</th>
                    <th>Origem</th>
                    <th>Empresa / Área</th>
                    <th>Indicado por</th>
                    <th>Admissão</th>
                    <th>Status / Bônus</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const completou = l.diasRestantes !== null && l.diasRestantes <= 0
                    const cor = completou ? 'var(--ok)' : l.diasRestantes != null && l.diasRestantes <= 15 ? 'var(--warn)' : 'var(--mut)'
                    return (
                      <tr key={`${l.origem}-${l.id}`}>
                        <td>
                          <Link to={l.link} className="tdm" style={{ textDecoration: 'none', color: 'var(--fg)' }}>
                            {l.nome}
                          </Link>
                          <div className="tds">{l.cargo}</div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--mut)' }}>
                          {l.origem === 'colaborador' ? 'Prestador' : 'Estagiário'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--mut)' }}>{l.empresa} · {l.area || '—'}</td>
                        <td style={{ fontSize: 12 }}>{l.indicadoPorNome}</td>
                        <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDate(l.dataAdmissao)}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: cor }}>
                          {l.diasRestantes === null
                            ? 'Sem data'
                            : completou
                              ? '✓ Bônus liberado'
                              : `${l.diasRestantes}d para liberar`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
