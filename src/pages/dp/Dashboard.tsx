import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { Colaborador, Estagiario } from '../../types'

const COLORS = ['#066E3E', '#3BE476', '#8DF768', '#F0EE7A', '#A0E3F3', '#F5B3D8']

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

  return (
    <>
      <Topbar title="Dashboard DP" icon="◈" />
      <div className="content">
        {loading && <div className="empty-state">Carregando…</div>}

        <div className="krow k4">
          <KpiCard label="Colaboradores ativos" value={kpis.colAtivos} icon="◉" tone="g" meta={`Total: ${kpis.totalCol}`} />
          <KpiCard label="Estagiários ativos" value={kpis.estAtivos} icon="◱" tone="b" meta={`Total: ${kpis.totalEst}`} />
          <KpiCard label="Em férias" value={kpis.colFerias} icon="☀" tone="a" />
          <KpiCard label="Experiência pendente" value={kpis.expPend} icon="⧗" tone={kpis.expPend > 0 ? 'r' : 'g'} meta="45/90 dias" />
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
                {(['ativo', 'finalizado', 'desligado'] as const).map(st => {
                  const count = estagiarios.filter(e => e.status === st).length
                  if (count === 0) return null
                  return (
                    <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                      <span className={`bdg ${st === 'ativo' ? 'ok' : st === 'finalizado' ? 'info' : 'bad'}`}>
                        {st === 'ativo' ? 'Ativos' : st === 'finalizado' ? 'Finalizados' : 'Desligados'}
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
