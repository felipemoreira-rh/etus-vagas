import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import {
  Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList,
  PieChart, Pie, Legend,
} from 'recharts'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { Candidato, Colaborador, Estagiario, Genero, Vaga } from '../../types'
import {
  CANDIDATO_FASE_LABEL,
  CANDIDATO_FASE_ORDER,
  GENERO_LABEL,
  getVagaEmpresas,
  STATUS_LABELS,
} from '../../types'

const SLA_META_DIAS = 30

// Paleta usada nos gráficos coloridos (vagas por time + pie de gênero).
// Distintiva o suficiente pra dar pra ler na tela com até 12 categorias.
const PALETA: string[] = [
  '#066E3E', '#3BE476', '#8DF768', '#C5F07A', '#F0EE7A',
  '#A0E3F3', '#73B6FF', '#7C5BD9', '#C57BFF', '#F5B3D8',
  '#FF8A65', '#E45656',
]

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function slaBarColor(days: number, meta = SLA_META_DIAS) {
  if (days >= meta) return 'linear-gradient(90deg, #8c2330, #F5B3D8)'
  if (days >= meta - 5) return 'linear-gradient(90deg, #8a6a00, #F0EE7A)'
  return 'linear-gradient(90deg, #066E3E, #3BE476)'
}

// Calcula dias que uma vaga finalizada ficou aberta. Prioriza `diasAberta`
// (gravado quando a movimentação foi pra finalizada/cancelada), depois
// `dataFechamento - createdAt`, depois `updatedAt - createdAt` (fallback
// pra docs antigos sem esses campos).
function diasFinalizada(v: Vaga): number | null {
  if (typeof v.diasAberta === 'number') return v.diasAberta
  const ini = v.createdAt?.toDate?.()
  const fim = v.dataFechamento?.toDate?.() ?? v.updatedAt?.toDate?.()
  if (!ini || !fim) return null
  return Math.max(0, daysBetween(ini, fim))
}

export default function Indicadores() {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [prestadores, setPrestadores] = useState<Colaborador[]>([])
  const [estagiarios, setEstagiarios] = useState<Estagiario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubV = onSnapshot(query(collection(db, 'vagas')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) }))
      setVagas(list)
      setLoading(false)
    })
    const unsubC = onSnapshot(query(collection(db, 'candidatos')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Candidato, 'id'>) }))
      setCandidatos(list)
    })
    const unsubP = onSnapshot(query(collection(db, 'colaboradores')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) }))
      setPrestadores(list)
    })
    const unsubE = onSnapshot(query(collection(db, 'estagiarios')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Estagiario, 'id'>) }))
      setEstagiarios(list)
    })
    return () => { unsubV(); unsubC(); unsubP(); unsubE() }
  }, [])

  const kpis = useMemo(() => {
    const abertas = vagas.filter(v => ['aberta','triagem','entrevistas','proposta'].includes(v.status)).length
    const finalizadas = vagas.filter(v => v.status === 'contratada')
    const propostas = vagas.filter(v => v.status === 'proposta').length

    // SLA médio das vagas FINALIZADAS — tempo real até fechar.
    const diasList = finalizadas
      .map(v => diasFinalizada(v))
      .filter((d): d is number => typeof d === 'number')
    const slaMed = diasList.length
      ? Math.round(diasList.reduce((a, b) => a + b, 0) / diasList.length)
      : 0

    // SLA das vagas EM ABERTO (quanto tempo já estão na fila).
    const ativos = vagas.filter(v => ['aberta','triagem','entrevistas','proposta'].includes(v.status))
    const hoje = new Date()
    const sumAtivos = ativos.reduce((acc, v) => {
      const ini = v.createdAt?.toDate?.() ?? hoje
      return acc + daysBetween(ini, hoje)
    }, 0)
    const slaAtivos = ativos.length ? Math.round(sumAtivos / ativos.length) : 0

    return { abertas, finalizadas: finalizadas.length, propostas, slaMed, slaAtivos }
  }, [vagas])

  // Distribuição de gênero (todas as 8 opções possíveis aparecem como
  // fatias separadas), combinando prestadores ativos + estagiários ativos.
  const generoData = useMemo(() => {
    const map = new Map<Genero, number>()
    const inc = (g?: Genero) => {
      if (!g) return
      map.set(g, (map.get(g) ?? 0) + 1)
    }
    prestadores.filter(p => p.status !== 'desligado').forEach(p => inc(p.genero))
    estagiarios.filter(e => e.status !== 'desligado').forEach(e => inc(e.genero))
    return [...map.entries()]
      .map(([g, value]) => ({ key: g, name: GENERO_LABEL[g], value }))
      .sort((a, b) => b.value - a.value)
  }, [prestadores, estagiarios])

  const totalGenero = useMemo(
    () => generoData.reduce((a, b) => a + b.value, 0),
    [generoData],
  )

  const vagasByTime = useMemo(() => {
    const map = new Map<string, number>()
    vagas.forEach(v => {
      if (!v.time) return
      map.set(v.time, (map.get(v.time) ?? 0) + 1)
    })
    return [...map.entries()]
      .map(([time, qt]) => ({ time, qt }))
      .sort((a, b) => b.qt - a.qt)
      .slice(0, 12)
  }, [vagas])

  const funil = useMemo(() => {
    const map = new Map<string, number>()
    candidatos.forEach(c => map.set(c.fase, (map.get(c.fase) ?? 0) + 1))
    const items = CANDIDATO_FASE_ORDER
      .filter(f => !['reprovado','desistente'].includes(f))
      .map(f => ({ fase: f, label: CANDIDATO_FASE_LABEL[f], count: map.get(f) ?? 0 }))
    const max = Math.max(...items.map(i => i.count), 1)
    return items.map((item, i) => {
      const prev = i > 0 ? items[i - 1].count : item.count
      const conv = prev > 0 ? Math.round((item.count / prev) * 100) : 100
      return { ...item, pct: Math.round((item.count / max) * 100), conv }
    })
  }, [candidatos])

  const slaItems = useMemo(() => {
    const hoje = new Date()
    return vagas
      .filter(v => ['aberta','triagem','entrevistas','proposta'].includes(v.status))
      .map(v => {
        const ini = v.createdAt?.toDate?.() ?? hoje
        const days = daysBetween(ini, hoje)
        return { v, days }
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 6)
  }, [vagas])

  return (
    <>
      <Topbar
        title="Indicadores"
        icon="◈"
        actions={
          <>
            <Link to="/rh/vagas/nova" className="tbtn pri">＋ Nova vaga</Link>
            <Link to="/rh/vagas" className="tbtn">Ver vagas</Link>
          </>
        }
      />
      <div className="content">
        <div className="krow k4">
          <KpiCard
            label="Vagas em andamento"
            value={kpis.abertas}
            icon="◱"
            tone="g"
            meta={`Em aberto há ~${kpis.slaAtivos}d em média`}
          />
          <KpiCard
            label="Finalizadas"
            value={kpis.finalizadas}
            icon="✓"
            tone="b"
            meta="Acumulado"
          />
          <KpiCard
            label="Em proposta"
            value={kpis.propostas}
            icon="◆"
            tone="a"
            meta="Prestes a fechar"
          />
          <KpiCard
            label="SLA médio (até fechar)"
            value={kpis.slaMed}
            icon="⧗"
            tone={kpis.slaMed >= SLA_META_DIAS ? 'r' : kpis.slaMed >= 20 ? 'a' : 'g'}
            meta={`Meta ${SLA_META_DIAS}d · vagas finalizadas`}
          />
        </div>

        <div className="body-grid bg-2">
          <div className="panel">
            <div className="ph">
              <div className="pt">
                <span className="pdot" style={{ background: 'var(--g600)' }} />
                SLA das vagas ativas
              </div>
              <Link to="/rh/vagas" className="pact">Ver todas →</Link>
            </div>
            <div className="panel-scroll">
              {loading ? (
                <div className="empty-sub">Carregando…</div>
              ) : slaItems.length === 0 ? (
                <div className="empty">
                  <div className="empty-ico">◈</div>
                  <div className="empty-ttl">Sem vagas ativas</div>
                  <div className="empty-sub">Aguardando novas aberturas.</div>
                </div>
              ) : slaItems.map(({ v, days }, i) => {
                const pct = Math.min((days / SLA_META_DIAS) * 100, 100)
                return (
                  <div key={v.id}>
                    <div className="sla-item">
                      <div className="sla-hd">
                        <div>
                          <div className="sla-nm">{v.cargo}</div>
                          <div className="sla-dp">{v.time} · {getVagaEmpresas(v).join(' / ') || '—'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="sla-dv" style={{ color: days >= SLA_META_DIAS ? 'var(--bad)' : days >= 25 ? 'var(--warn)' : 'var(--ok)' }}>
                            {days}d
                          </div>
                          <div className="sla-dl">de {SLA_META_DIAS}d</div>
                        </div>
                      </div>
                      <div className="sla-tr">
                        <div className="sla-f" style={{ width: `${pct}%`, background: slaBarColor(days) }} />
                        <div className="sla-mk" style={{ left: '100%' }} />
                      </div>
                      <div className="sla-tags">
                        <span className={`badge badge-${v.status}`}>{STATUS_LABELS[v.status]}</span>
                        <span className="bdg gray">{v.gestorNome}</span>
                      </div>
                    </div>
                    {i < slaItems.length - 1 && <div className="sep" />}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <div className="pt">
                <span className="pdot" style={{ background: 'var(--info)' }} />
                Distribuição por gênero
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>
                {totalGenero} prestadores + estagiários
              </div>
            </div>
            {generoData.length === 0 ? (
              <div className="empty-sub">Nenhum dado de gênero cadastrado ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={generoData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={90}
                    paddingAngle={2}
                    isAnimationActive
                    animationDuration={900}
                  >
                    {generoData.map((entry, i) => (
                      <Cell key={entry.key} fill={PALETA[i % PALETA.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} (${totalGenero ? Math.round((v / totalGenero) * 100) : 0}%)`} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="body-grid bg-2e">
          <div className="panel">
            <div className="ph">
              <div className="pt">
                <span className="pdot" style={{ background: 'var(--g400)' }} />
                Funil de candidatos
              </div>
              <Link to="/rh/candidatos" className="pact">Ver todos →</Link>
            </div>
            <div className="panel-scroll">
              {candidatos.length === 0 ? (
                <div className="empty">
                  <div className="empty-ico">◉</div>
                  <div className="empty-ttl">Nenhum candidato</div>
                  <div className="empty-sub">Cadastre candidatos nas vagas ativas.</div>
                </div>
              ) : funil.map((f) => (
                <div className="fn-i" key={f.fase}>
                  <div className="fn-l">{f.label}</div>
                  <div className="fn-tw">
                    <div className="fn-f" style={{
                      width: `${Math.max(f.pct, 6)}%`,
                      background: 'linear-gradient(90deg, var(--g600), var(--g400))',
                    }}>
                      {f.count > 0 ? f.count : ''}
                    </div>
                  </div>
                  <div className="fn-c">{f.count}</div>
                  <div className="fn-p">{f.conv}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <div className="pt">
                <span className="pdot" style={{ background: 'var(--warn)' }} />
                Vagas por time
              </div>
            </div>
            {vagasByTime.length === 0 ? (
              <div className="empty-sub">Sem vagas registradas.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={vagasByTime}
                  layout="horizontal"
                  margin={{ left: 8, right: 16, top: 8, bottom: 56 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis
                    dataKey="time"
                    type="category"
                    fontSize={11}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis type="number" fontSize={11} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(6,110,62,0.06)' }} />
                  <Bar
                    dataKey="qt"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {vagasByTime.map((entry, i) => (
                      <Cell key={entry.time} fill={PALETA[i % PALETA.length]} />
                    ))}
                    <LabelList dataKey="qt" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
