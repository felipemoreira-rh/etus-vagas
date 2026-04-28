import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { Colaborador, Estagiario } from '../../types'

const COLORS = ['#066E3E', '#3BE476', '#8DF768', '#F0EE7A', '#A0E3F3', '#F5B3D8']

// Mistura linear entre verde (#3BE476) e vermelho (#E45656) baseada em
// percentual de progresso (0=verde, 100=vermelho). Usado nas barras de
// contrato dos estagiários — quanto mais perto do fim, mais vermelho.
function progressColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct)) / 100
  // verde: 59,228,118 · vermelho: 228,86,86
  const r = Math.round(59 + (228 - 59) * p)
  const g = Math.round(228 + (86 - 228) * p)
  const b = Math.round(118 + (86 - 118) * p)
  return `rgb(${r},${g},${b})`
}

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

interface ContratoEstagioInfo {
  id: string
  nome: string
  empresa: string
  area: string
  inicio: Date
  fim: Date
  totalDias: number
  decorridos: number
  restantes: number
  pct: number
}

export default function DpDashboard() {
  const [estagiarios, setEstagiarios] = useState<Estagiario[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'estagiarios')), (s) => {
      setEstagiarios(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Estagiario, 'id'>) })))
      setLoading(false)
    }, () => setLoading(false))
    const u2 = onSnapshot(query(collection(db, 'colaboradores')), (s) => {
      setColaboradores(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) })))
    })
    return () => { u1(); u2() }
  }, [])

  const kpis = useMemo(() => {
    const estAtivos = estagiarios.filter(e => e.status === 'ativo').length
    const colAtivos = colaboradores.filter(c => c.status === 'ativo').length
    const colFerias = colaboradores.filter(c => c.status === 'ferias').length
    const expPend = colaboradores.filter(c => {
      if (!c.experiencia) return false
      return c.experiencia.resultado45 === 'pendente' || c.experiencia.resultado90 === 'pendente'
    }).length
    return { estAtivos, colAtivos, colFerias, expPend, totalEst: estagiarios.length, totalCol: colaboradores.length }
  }, [estagiarios, colaboradores])

  const colByArea = useMemo(() => {
    const map = new Map<string, number>()
    colaboradores.filter(c => c.status === 'ativo').forEach(c => {
      map.set(c.area || 'Outros', (map.get(c.area || 'Outros') ?? 0) + 1)
    })
    return [...map.entries()].map(([name, value]) => ({ name, value }))
  }, [colaboradores])

  // Contratos de estágio ativos com data de início e término — para a
  // barra de progresso (verde no início, vermelha próximo do fim).
  const contratosEstagio: ContratoEstagioInfo[] = useMemo(() => {
    const hoje = new Date()
    return estagiarios
      .filter(e => e.status === 'ativo' && e.dataInicio && e.dataTermino)
      .map(e => {
        const inicio = e.dataInicio.toDate()
        const fim = e.dataTermino.toDate()
        const totalDias = Math.max(1, daysBetween(inicio, fim))
        const decorridos = Math.max(0, Math.min(totalDias, daysBetween(inicio, hoje)))
        const restantes = Math.max(0, daysBetween(hoje, fim))
        const pct = Math.round((decorridos / totalDias) * 100)
        return {
          id: e.id, nome: e.nome,
          empresa: e.empresa, area: e.area,
          inicio, fim, totalDias, decorridos, restantes, pct,
        }
      })
      .sort((a, b) => a.restantes - b.restantes)
  }, [estagiarios])

  // Alerta de 30 dias: contratos terminando em até 30 dias.
  const alerta30d = contratosEstagio.filter(c => c.restantes <= 30)

  return (
    <>
      <Topbar title="Dashboard DP" icon="◈" />
      <div className="content">
        {loading && <div className="empty-state">Carregando…</div>}

        <div className="krow k4">
          <KpiCard label="Colaboradores ativos" value={kpis.colAtivos} icon="◉" tone="g" meta={`Total: ${kpis.totalCol}`} />
          <KpiCard label="Estagiários ativos" value={kpis.estAtivos} icon="◱" tone="b" meta={`Total: ${kpis.totalEst}`} />
          <KpiCard label="Em férias" value={kpis.colFerias} icon="☀" tone="a" />
          <KpiCard
            label="Contratos a vencer (≤30d)"
            value={alerta30d.length}
            icon="⏱"
            tone={alerta30d.length > 0 ? 'r' : 'g'}
            meta="Estágios"
          />
        </div>

        <div className="panel">
          <div className="ph">
            <div className="pt">
              <span className="pdot" style={{ background: 'var(--g600)' }} />
              Contratos de estágio · progresso
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)' }}>
              Verde = começou agora · Vermelho = perto do fim
            </div>
          </div>
          {contratosEstagio.length === 0 ? (
            <div className="empty-sub">Nenhum estagiário ativo com contrato cadastrado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {contratosEstagio.map(c => {
                const cor = progressColor(c.pct)
                const alerta = c.restantes <= 30
                return (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {c.nome}
                        <span style={{ color: 'var(--mut)', fontWeight: 400, marginLeft: 6 }}>
                          · {c.empresa} · {c.area}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: alerta ? 'var(--warn)' : 'var(--mut)', fontWeight: alerta ? 700 : 500 }}>
                        {c.restantes === 0 ? 'Vence hoje' : `${c.restantes}d restantes`} · {fmtDate(Timestamp.fromDate(c.fim))}
                      </div>
                    </div>
                    <div style={{ height: 10, background: 'var(--b1)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${c.pct}%`,
                          background: cor,
                          transition: 'width .25s, background .25s',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--mut)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{fmtDate(Timestamp.fromDate(c.inicio))}</span>
                      <span>{c.pct}%</span>
                      <span>{fmtDate(Timestamp.fromDate(c.fim))}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {alerta30d.length > 0 && (
            <div style={{ marginTop: 14, padding: 10, background: 'var(--card2)', borderRadius: 8, fontSize: 12 }}>
              <b>⚠ {alerta30d.length} contrato{alerta30d.length > 1 ? 's' : ''} terminando em até 30 dias.</b>{' '}
              <Link to="/dp/estagiarios" style={{ color: 'var(--g600)' }}>Abrir aba de estagiários →</Link>
            </div>
          )}
        </div>

        <div className="body-grid bg-2e">
          <div className="panel">
            <div className="ph">
              <div className="pt"><span className="pdot" style={{ background: 'var(--g600)' }} />Colaboradores por área</div>
            </div>
            {colByArea.length === 0 ? (
              <div className="empty-sub">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={colByArea} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                    {colByArea.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="panel">
            <div className="ph">
              <div className="pt"><span className="pdot" style={{ background: 'var(--warn)' }} />Estagiários por status</div>
            </div>
            {estagiarios.length === 0 ? (
              <div className="empty-sub">Sem estagiários.</div>
            ) : (
              <div className="panel-scroll">
                {(['ativo', 'efetivado', 'finalizado', 'desligado'] as const).map(st => {
                  const count = estagiarios.filter(e => e.status === st).length
                  if (count === 0) return null
                  return (
                    <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                      <span className={`bdg ${st === 'ativo' ? 'ok' : st === 'efetivado' ? 'purple' : st === 'finalizado' ? 'info' : 'bad'}`}>
                        {st === 'ativo' ? 'Ativos' : st === 'efetivado' ? 'Efetivados' : st === 'finalizado' ? 'Finalizados' : 'Desligados'}
                      </span>
                      <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--ff)', letterSpacing: '-0.02em' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
