import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../../firebase'
import type { Vaga, VagaStatus } from '../../types'
import { STATUS_LABELS, STATUS_ORDER } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import KpiCard from '../../components/KpiCard'

const COLORS: Record<VagaStatus, string> = {
  aberta: '#A0E3F3',
  triagem: '#F0EE7A',
  entrevistas: '#F5B3D8',
  proposta: '#C5F07A',
  contratada: '#3BE476',
  pausada: '#BFEDF8',
  cancelada: '#D6D4D1',
}

export default function Dashboard() {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'vagas'), orderBy('createdAt', 'desc'))
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
  }, [])

  const stats = useMemo(() => {
    const porStatus: Record<VagaStatus, number> = {
      aberta: 0,
      triagem: 0,
      entrevistas: 0,
      proposta: 0,
      contratada: 0,
      pausada: 0,
      cancelada: 0,
    }
    const porEmpresa = new Map<string, number>()
    const porTime = new Map<string, number>()
    const porRegime = new Map<string, number>()

    vagas.forEach((v) => {
      porStatus[v.status]++
      porEmpresa.set(v.empresa || '—', (porEmpresa.get(v.empresa || '—') ?? 0) + 1)
      porTime.set(v.time || '—', (porTime.get(v.time || '—') ?? 0) + 1)
      porRegime.set(v.regime, (porRegime.get(v.regime) ?? 0) + 1)
    })

    const emAndamento = vagas.filter(
      (v) => !['contratada', 'cancelada'].includes(v.status),
    ).length

    const agora = Date.now()
    const trinta = 1000 * 60 * 60 * 24 * 30
    const abertasUltimoMes = vagas.filter((v) => {
      const ts = v.createdAt
      if (!ts || typeof ts !== 'object' || !('toDate' in ts)) return false
      return (ts as { toDate: () => Date }).toDate().getTime() > agora - trinta
    }).length

    return {
      total: vagas.length,
      emAndamento,
      contratadas: porStatus.contratada,
      canceladas: porStatus.cancelada,
      abertasUltimoMes,
      porStatus,
      porEmpresa: Array.from(porEmpresa, ([name, value]) => ({ name, value })).sort(
        (a, b) => b.value - a.value,
      ),
      porTime: Array.from(porTime, ([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      porRegime: Array.from(porRegime, ([name, value]) => ({ name, value })),
    }
  }, [vagas])

  const statusChartData = STATUS_ORDER.filter((s) => stats.porStatus[s] > 0).map((s) => ({
    name: STATUS_LABELS[s],
    value: stats.porStatus[s],
    key: s,
  }))

  const recentes = vagas.slice(0, 6)

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral do funil de vagas · Time de Gente.</p>
        </div>
        <Link to="/rh/vagas" className="btn btn-primary">
          Ver todas as vagas
        </Link>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total de vagas" value={stats.total} accent />
        <KpiCard label="Em andamento" value={stats.emAndamento} />
        <KpiCard label="Contratadas" value={stats.contratadas} />
        <KpiCard label="Abertas nos últimos 30d" value={stats.abertasUltimoMes} />
        <KpiCard label="Canceladas" value={stats.canceladas} />
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Vagas por status</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {statusChartData.map((entry) => (
                    <Cell key={entry.key} fill={COLORS[entry.key as VagaStatus]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Top times (por vagas abertas)</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={stats.porTime} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="#EBE9E5" strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip />
                <Bar dataKey="value" fill="#8DF768" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="two-col">
        <div className="card">
          <h3>Vagas por empresa do grupo</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={stats.porEmpresa}>
                <CartesianGrid stroke="#EBE9E5" strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#066E3E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Vagas por regime</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={stats.porRegime}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {stats.porRegime.map((_, i) => (
                    <Cell key={i} fill={['#066E3E', '#8DF768', '#F0EE7A', '#F5B3D8', '#A0E3F3'][i % 5]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Vagas mais recentes</h3>
          <Link to="/rh/vagas" className="muted" style={{ fontSize: 13 }}>
            Ver todas →
          </Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cargo</th>
              <th>Gestor</th>
              <th>Empresa</th>
              <th>Time</th>
              <th>Status</th>
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
            ) : recentes.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Ainda não existem vagas registradas.
                </td>
              </tr>
            ) : (
              recentes.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.cargo}</td>
                  <td>{v.gestorNome}</td>
                  <td>{v.empresa}</td>
                  <td>{v.time}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/rh/vagas/${v.id}`} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }}>
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
