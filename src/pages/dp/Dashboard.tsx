import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, Timestamp, where,
} from 'firebase/firestore'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { Colaborador, Estagiario } from '../../types'

// Cria notificações de aniversário para todos os usuários RH no dia certo,
// com debounce diário via localStorage para evitar duplicatas se vários
// usuários abrirem o dashboard.
async function disparaNotifAniversario(c: Colaborador) {
  if (!c.dataNascimento) return
  const hoje = new Date()
  const aniv = c.dataNascimento.toDate()
  if (aniv.getDate() !== hoje.getDate() || aniv.getMonth() !== hoje.getMonth()) return
  const key = `notif-aniv-${c.id}-${hoje.toISOString().slice(0, 10)}`
  if (localStorage.getItem(key)) return
  try {
    // Busca usuários RH para destinatários.
    const { getDocs } = await import('firebase/firestore')
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'rh')))
    for (const u of snap.docs) {
      await addDoc(collection(db, 'notificacoes'), {
        destinatarioUid: u.id,
        tipo: 'onboarding_concluido',
        titulo: `🎂 Hoje é aniversário de ${c.nome}`,
        mensagem: `${c.nome} (${c.cargo} · ${c.empresa}) faz aniversário hoje. Lembre de parabenizar!`,
        link: `/dp/colaboradores/${c.id}`,
        lida: false,
        createdAt: serverTimestamp(),
        refColecao: 'colaboradores',
        refId: c.id,
      })
    }
    localStorage.setItem(key, '1')
  } catch {
    // best-effort — ignora falhas pra não travar o dashboard
  }
}

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
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) }))
      setColaboradores(list)
      // dispara notificações de aniversário (best-effort, deduplica via localStorage)
      list.filter(c => c.status !== 'desligado').forEach(c => { void disparaNotifAniversario(c) })
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

  // Aniversariantes do mês (incluindo o próprio dia de hoje em destaque).
  const aniversariantes = useMemo(() => {
    const hoje = new Date()
    const mesAtual = hoje.getMonth()
    return colaboradores
      .filter(c => c.status !== 'desligado' && c.dataNascimento)
      .map(c => ({ c, d: c.dataNascimento!.toDate() }))
      .filter(({ d }) => d.getMonth() === mesAtual)
      .sort((a, b) => a.d.getDate() - b.d.getDate())
  }, [colaboradores])

  // Indicações ativas (em janela de 90 dias, ainda não liberadas).
  const indicacoesAtivas = useMemo(() => {
    const hoje = new Date()
    return colaboradores.filter(c => {
      if (!c.indicadoPorNome || !c.dataAdmissao) return false
      const limite = c.dataAdmissao.toDate()
      limite.setDate(limite.getDate() + 90)
      return limite > hoje
    })
  }, [colaboradores])

  // Suspensões de contrato ativas (qualquer prestador com pelo menos uma).
  const suspensoesAtivas = useMemo(() => {
    return colaboradores.filter(c => (c.suspensoes || []).some(s => s.status === 'ativa'))
  }, [colaboradores])

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
          <KpiCard label="Prestadores ativos" value={kpis.colAtivos} icon="◉" tone="g" meta={`Total: ${kpis.totalCol}`} />
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

        <div className="krow k3">
          <CardAniversariantes lista={aniversariantes} />
          <CardIndicacoes lista={indicacoesAtivas} />
          <CardSuspensoes lista={suspensoesAtivas} />
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

// ─────────── Cards extras: aniversariantes, indicações, suspensões ───────────
function CardAniversariantes({ lista }: { lista: { c: Colaborador; d: Date }[] }) {
  const hoje = new Date()
  const hojeAniv = lista.filter(({ d }) => d.getDate() === hoje.getDate())
  return (
    <div className="panel">
      <div className="ph">
        <div className="pt"><span className="pdot" style={{ background: '#f59e0b' }} />🎂 Aniversariantes do mês</div>
        {hojeAniv.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--g600)', fontWeight: 700 }}>
            {hojeAniv.length} hoje
          </div>
        )}
      </div>
      {lista.length === 0 ? (
        <div className="empty-sub" style={{ padding: 8 }}>Nenhum aniversariante este mês.</div>
      ) : (
        <div className="panel-scroll" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {lista.map(({ c, d }) => {
            const isHoje = d.getDate() === hoje.getDate()
            return (
              <Link
                key={c.id}
                to={`/dp/colaboradores/${c.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', textDecoration: 'none', color: 'var(--fg)',
                  fontSize: 12,
                }}
              >
                <span style={{
                  background: isHoje ? '#f59e0b' : 'var(--card2)',
                  color: isHoje ? '#fff' : 'var(--mut)',
                  borderRadius: 6, padding: '3px 6px', fontWeight: 700, minWidth: 30, textAlign: 'center',
                }}>
                  {String(d.getDate()).padStart(2, '0')}
                </span>
                <span style={{ flex: 1 }}>{c.nome}</span>
                <span style={{ fontSize: 10, color: 'var(--mut)' }}>{c.empresa}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CardIndicacoes({ lista }: { lista: Colaborador[] }) {
  return (
    <div className="panel">
      <div className="ph">
        <div className="pt"><span className="pdot" style={{ background: 'var(--g600)' }} />★ Indicações em curso</div>
        <Link to="/dp/indicacoes" style={{ fontSize: 11, color: 'var(--g600)' }}>Ver todas →</Link>
      </div>
      {lista.length === 0 ? (
        <div className="empty-sub" style={{ padding: 8 }}>Nenhuma indicação em janela de 90 dias.</div>
      ) : (
        <div className="panel-scroll" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {lista.slice(0, 8).map(c => {
            let dias = 0
            if (c.dataAdmissao) {
              const limite = c.dataAdmissao.toDate()
              limite.setDate(limite.getDate() + 90)
              dias = Math.ceil((limite.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            }
            return (
              <Link
                key={c.id}
                to={`/dp/colaboradores/${c.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', textDecoration: 'none', color: 'var(--fg)',
                  fontSize: 12,
                }}
              >
                <span style={{ flex: 1 }}>
                  {c.nome}
                  <div style={{ fontSize: 10, color: 'var(--mut)' }}>por {c.indicadoPorNome}</div>
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: dias <= 15 ? 'var(--warn)' : 'var(--mut)',
                }}>
                  {dias}d
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CardSuspensoes({ lista }: { lista: Colaborador[] }) {
  return (
    <div className="panel">
      <div className="ph">
        <div className="pt"><span className="pdot" style={{ background: '#2563eb' }} />⏸ Suspensões ativas</div>
        <Link to="/dp/suspensoes" style={{ fontSize: 11, color: 'var(--g600)' }}>Ver histórico →</Link>
      </div>
      {lista.length === 0 ? (
        <div className="empty-sub" style={{ padding: 8 }}>Nenhuma suspensão em curso.</div>
      ) : (
        <div className="panel-scroll" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {lista.slice(0, 8).map(c => {
            const ativa = (c.suspensoes || []).find(s => s.status === 'ativa')
            return (
              <Link
                key={c.id}
                to={`/dp/colaboradores/${c.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', textDecoration: 'none', color: 'var(--fg)',
                  fontSize: 12,
                }}
              >
                <span style={{ flex: 1 }}>
                  {c.nome}
                  <div style={{ fontSize: 10, color: 'var(--mut)' }}>{c.empresa}</div>
                </span>
                <span style={{ fontSize: 10, color: 'var(--mut)' }}>
                  desde {fmtDate(ativa?.inicio)}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
