import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import type { Estagiario, Colaborador } from '../../types'

export default function DpDashboard() {
  const [estagiarios, setEstagiarios] = useState<Estagiario[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'estagiarios' | 'colaboradores'>('estagiarios')

  useEffect(() => {
    // Carregar estagiários
    const qEstagiarios = query(collection(db, 'estagiarios'), orderBy('dataInicio', 'desc'))
    const unsubEstagiarios = onSnapshot(qEstagiarios, (snap) => {
      setEstagiarios(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Estagiario, 'id'>) })))
    })

    // Carregar colaboradores
    const qColaboradores = query(collection(db, 'colaboradores'), orderBy('dataInicio', 'desc'))
    const unsubColaboradores = onSnapshot(qColaboradores, (snap) => {
      setColaboradores(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) })))
    })

    setLoading(false)

    return () => {
      unsubEstagiarios()
      unsubColaboradores()
    }
  }, [])

  // Calcular progresso do contrato de estágio
  function getContratoProgresso(estagiario: Estagiario): { percentual: number; diasRestantes: number; status: 'verde' | 'amarelo' | 'vermelho' | 'encerrado' } {
    if (estagiario.status === 'encerrado' || estagiario.status === 'efetivado') {
      return { percentual: 100, diasRestantes: 0, status: 'encerrado' }
    }

    const inicio = estagiario.dataInicio.toDate ? estagiario.dataInicio.toDate() : new Date(estagiario.dataInicio as unknown as number)
    const fim = estagiario.dataFim.toDate ? estagiario.dataFim.toDate() : new Date(estagiario.dataFim as unknown as number)
    
    const agora = new Date()
    const totalDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    const diasDecorridos = Math.ceil((agora.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    const diasRestantes = Math.ceil((fim.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))
    
    const percentual = Math.min(100, Math.max(0, (diasDecorridos / totalDias) * 100))
    
    let status: 'verde' | 'amarelo' | 'vermelho' = 'verde'
    if (diasRestantes <= 30) {
      status = 'vermelho'
    } else if (diasRestantes <= 60) {
      status = 'amarelo'
    }
    
    return { percentual, diasRestantes, status }
  }

  // Verificar se há estagiários perto do final (30 dias)
  const estagiariosProxFim = useMemo(() => {
    return estagiarios.filter(e => {
      const { diasRestantes } = getContratoProgresso(e)
      return diasRestantes <= 30 && diasRestantes > 0 && e.status === 'ativo'
    })
  }, [estagiarios])

  // Estagiários ativos
  const estagiariosAtivos = useMemo(() => {
    return estagiarios.filter(e => e.status === 'ativo' || e.status === 'efetivado')
  }, [estagiarios])

  // Colaboradores ativos
  const colaboradoresAtivos = useMemo(() => {
    return colaboradores.filter(c => c.status === 'ativo')
  }, [colaboradores])

  if (loading) {
    return <div className="empty-state">Carregando…</div>
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard DP</h1>
          <p>Gerencie estagiários e colaboradores.</p>
        </div>
      </div>

      {/* Alertas de contratos próximos do fim */}
      {estagiariosProxFim.length > 0 && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--red-50)', borderColor: 'var(--red-200)' }}>
          <h3 style={{ color: 'var(--red-700)', marginTop: 0 }}>
            ⚠️ {estagiariosProxFim.length} contrato(s) de estágio próximo(s) do fim
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {estagiariosProxFim.map(e => {
              const { diasRestantes } = getContratoProgresso(e)
              return (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>{e.nome}</strong> - {e.cargo} ({e.empresa})</span>
                  <span style={{ color: 'var(--red-600)', fontWeight: 600 }}>
                    {diasRestantes} dias restantes
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card" style={{ background: 'var(--green-50)', borderColor: 'var(--green-100)' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Estagiários Ativos
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--green-700)' }}>
            {estagiariosAtivos.length}
          </div>
        </div>
        <div className="kpi-card" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Colaboradores Ativos
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--blue-700)' }}>
            {colaboradoresAtivos.length}
          </div>
        </div>
        <div className="kpi-card" style={{ background: 'var(--orange-50)', borderColor: 'var(--orange-100)' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Próximos do Fim (30d)
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--orange-700)' }}>
            {estagiariosProxFim.length}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
          <button 
            className={`btn ${activeTab === 'estagiarios' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('estagiarios')}
          >
            Estagiários
          </button>
          <button 
            className={`btn ${activeTab === 'colaboradores' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('colaboradores')}
          >
            Colaboradores
          </button>
        </div>

        {activeTab === 'estagiarios' && (
          <>
            {/* Barra de progresso dos contratos */}
            <h3>Andamento dos Contratos de Estágio</h3>
            {estagiariosAtivos.length === 0 ? (
              <div className="empty-state">Nenhum estagiário ativo.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                {estagiariosAtivos.map(e => {
                  const { percentual, diasRestantes, status } = getContratoProgresso(e)
                  
                  const corBarra = status === 'verde' ? 'var(--green-500)' 
                    : status === 'amarelo' ? 'var(--orange-500)' 
                    : status === 'vermelho' ? 'var(--red-500)' 
                    : 'var(--green-700)'
                  
                  return (
                    <div key={e.id} style={{ 
                      padding: 16, 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 8,
                      background: status === 'vermelho' ? 'var(--red-50)' : 'transparent'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <strong>{e.nome}</strong>
                          <span className="muted"> · {e.cargo} · {e.empresa}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: corBarra, fontWeight: 600 }}>
                            {e.status === 'efetivado' ? '✓ Efetivado' : `${diasRestantes} dias restantes`}
                          </span>
                        </div>
                      </div>
                      <div style={{ 
                        height: 8, 
                        background: 'var(--neutral-100)', 
                        borderRadius: 4, 
                        overflow: 'hidden' 
                      }}>
                        <div style={{ 
                          width: `${percentual}%`, 
                          height: '100%', 
                          background: corBarra,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>Início: {e.dataInicio.toDate ? e.dataInicio.toDate().toLocaleDateString('pt-BR') : '—'}</span>
                        <span>Fim: {e.dataFim.toDate ? e.dataFim.toDate().toLocaleDateString('pt-BR') : '—'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'colaboradores' && (
          <>
            <h3>Colaboradores Ativos</h3>
            {colaboradoresAtivos.length === 0 ? (
              <div className="empty-state">Nenhum colaborador ativo.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th>Empresa</th>
                    <th>Regime</th>
                    <th>Início</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradoresAtivos.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.nome}</td>
                      <td>{c.cargo}</td>
                      <td>{c.empresa}</td>
                      <td>{c.regime}</td>
                      <td>{c.dataInicio.toDate ? c.dataInicio.toDate().toLocaleDateString('pt-BR') : '—'}</td>
                      <td>
                        <span style={{ 
                          color: c.status === 'ativo' ? 'var(--green-600)' : 'var(--red-600)',
                          fontWeight: 500 
                        }}>
                          {c.status === 'ativo' ? 'Ativo' : 'Desligado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  )
}