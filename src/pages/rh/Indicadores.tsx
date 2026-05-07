import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import {
  Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList,
} from 'recharts'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { Candidato, Vaga, VagaStatus } from '../../types'
import {
  CANDIDATO_FASE_LABEL,
  CANDIDATO_FASE_ORDER,
  STATUS_LABELS,
} from '../../types'

const SLA_META_DIAS = 30

const STATUS_COLORS: Record<VagaStatus, string> = {
  aberta: '#066E3E',
  triagem: '#3BE476',
  entrevistas: '#8DF768',
  proposta: '#C5F07A',
  contratada: '#066E3E',
  pausada: '#F0EE7A',
  cancelada: '#F5B3D8',
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function slaBarColor(days: number, meta = SLA_META_DIAS) {
  if (days >= meta) return 'linear-gradient(90deg, #8c2330, #F5B3D8)'
  if (days >= meta - 5) return 'linear-gradient(90deg, #8a6a00, #F0EE7A)'
  return 'linear-gradient(90deg, #066E3E, #3BE476)'
}

export default function Indicadores() {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
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
    return () => { unsubV(); unsubC() }
  }, [])

  const kpis = useMemo(() => {
    const abertas = vagas.filter(v => ['aberta','triagem','entrevistas','proposta'].includes(v.status)).length
    const contratadas = vagas.filter(v => v.status === 'contratada').length
    const canceladas = vagas.filter(v => v.status === 'cancelada').length
    const propostas = vagas.filter(v => v.status === 'proposta').length

    const ativos = vagas.filter(v => ['aberta','triagem','entrevistas','proposta'].includes(v.status))
    const hoje = new Date()
    const sum = ativos.reduce((acc, v) => {
      const ini = v.createdAt?.toDate?.() ?? hoje
      return acc + daysBetween(ini, hoje)
    }, 0)
    const slaMed = ativos.length ? Math.round(sum / ativos.length) : 0

    return { abertas, contratadas, canceladas, propostas, slaMed }
  }, [vagas])

  const vagasByStatus = useMemo(() => {
    const map = new Map<VagaStatus, number>()
    vagas.forEach(v => map.set(v.status, (map.get(v.status) ?? 0) + 1))
    return [...map.entries()]
      .map(([status, value]) => ({ status, name: STATUS_LABELS[status], value }))
      .sort((a, b) => b.value - a.value)
  }, [vagas])

  const vagasByTime = useMemo(() => {
    const map = new Map<string, number>()
    vagas.forEach(v => {
      if (!v.time) return
      map.set(v.time, (map.get(v.time) ?? 0) + 1)
    })
    return [...map.entries()]
      .map(([time, qt]) => ({ time, qt }))
      .sort((a, b) => b.qt - a.qt)
      .slice(0, 8)
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
            meta={`SLA médio ${kpis.slaMed}d`}
          />
          <KpiCard
            label="Contratadas"
            value={kpis.contratadas}
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
            label="SLA médio (dias)"
            value={kpis.slaMed}
            icon="⧗"
            tone={kpis.slaMed >= SLA_META_DIAS ? 'r' : kpis.slaMed >= 20 ? 'a' : 'g'}
            meta={`Meta ${SLA_META_DIAS} dias`}
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
                          <div className="sla-dp">{v.time} · {v.empresa}</div>
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
                Distribuição por status
              </div>
            </div>
            {vagasByStatus.length === 0 ? (
              <div className="empty-sub">Sem dados ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={vagasByStatus} layout="vertical" margin={{ left: 24, right: 28, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" fontSize={11} width={110} />
                  <Tooltip cursor={{ fill: 'rgba(6,110,62,0.06)' }} />
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {vagasByStatus.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#066E3E'} />
                    ))}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
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
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={vagasByTime} layout="vertical" margin={{ left: 24, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis dataKey="time" type="category" fontSize={11} width={110} />
                  <Tooltip />
                  <Bar dataKey="qt" fill="#066E3E" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
