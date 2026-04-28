import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../../firebase'
import type { Candidato, CandidatoChecklist, Regime, Vaga } from '../../../types'
import { CHECKLIST_POR_REGIME } from '../../../types'

export default function Onboarding() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [busca, setBusca] = useState('')
  
  // Modal de editar checklist
  const [showModal, setShowModal] = useState(false)
  const [candidatoSelecionado, setCandidatoSelecionado] = useState<Candidato | null>(null)
  const [checklist, setChecklist] = useState<CandidatoChecklist[]>([])
  const [dataPrevistaInicio, setDataPrevistaInicio] = useState('')
  const [regimeSelecionado, setRegimeSelecionado] = useState<Regime>('CLT')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    // Carregar vagas
    const qVagas = query(collection(db, 'vagas'), orderBy('createdAt', 'desc'))
    const unsubVagas = onSnapshot(qVagas, (snap) => {
      setVagas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) })))
    })

    // Carregar candidatos em onboarding
    const qCandidatos = query(collection(db, 'candidatos'), orderBy('createdAt', 'desc'))
    const unsubCandidatos = onSnapshot(qCandidatos, (snap) => {
      const allCandidatos = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Candidato, 'id'>) }))
      // Filtrar apenas candidatos em onboarding
      setCandidatos(allCandidatos.filter(c => c.status === 'onboarding'))
      setLoading(false)
    })

    return () => {
      unsubVagas()
      unsubCandidatos()
    }
  }, [])

  const filtrados = useMemo(() => {
    return candidatos.filter((c) => {
      if (busca) {
        const hay = `${c.nome} ${c.email} ${c.vagaCargo || ''}`.toLowerCase()
        if (!hay.includes(busca.toLowerCase())) return false
      }
      return true
    })
  }, [candidatos, busca])

  function abrirChecklist(candidato: Candidato) {
    setCandidatoSelecionado(candidato)
    
    // Buscar regime da vaga
    const vaga = vagas.find(v => v.id === candidato.vagaId)
    const regime = vaga?.regime || 'CLT'
    setRegimeSelecionado(regime)
    
    // Se o candidato já tem checklist, usa ele; senão usa o padrão
    if (candidato.checklistOnboarding && candidato.checklistOnboarding.length > 0) {
      setChecklist(candidato.checklistOnboarding)
    } else {
      setChecklist(CHECKLIST_POR_REGIME[regime])
    }
    
    // Data prevista de início
    if (candidato.dataPrevistaInicio) {
      const date = candidato.dataPrevistaInicio.toDate ? candidato.dataPrevistaInicio.toDate() : new Date(candidato.dataPrevistaInicio as unknown as number)
      setDataPrevistaInicio(date.toISOString().split('T')[0])
    } else {
      setDataPrevistaInicio('')
    }
    
    setError(null)
    setFeedback(null)
    setShowModal(true)
  }

  async function handleSalvarChecklist(e: FormEvent) {
    e.preventDefault()
    if (!candidatoSelecionado) return

    setSaving(true)
    setError(null)
    setFeedback(null)

    try {
      const updateData: Record<string, unknown> = {
        checklistOnboarding: checklist,
        updatedAt: serverTimestamp(),
      }
      
      if (dataPrevistaInicio) {
        updateData.dataPrevistaInicio = new Date(dataPrevistaInicio)
      }
      
      await updateDoc(doc(db, 'candidatos', candidatoSelecionado.id), updateData)
      setFeedback('Checklist salvo com sucesso!')
      
      setTimeout(() => {
        setShowModal(false)
        setFeedback(null)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  function toggleChecklistItem(itemId: string, itemData?: string) {
    setChecklist(prev => prev.map(item => {
      if (item.id === itemId) {
        // Se tem campo de data, permite atualizar a data
        if (itemData !== undefined) {
          return { ...item, data: itemData }
        }
        return { ...item, checked: !item.checked }
      }
      return item
    }))
  }

  // Verificar se todos os itens foram concluídos
  function isChecklistCompleto(): boolean {
    return checklist.every(item => item.checked)
  }

  // Finalizar onboarding - mover para estagiários ou colaboradores
  async function finalizarOnboarding() {
    if (!candidatoSelecionado) return
    
    const vaga = vagas.find(v => v.id === candidatoSelecionado.vagaId)
    const regime = vaga?.regime || 'CLT'
    
    try {
      if (regime === 'ESTAGIO') {
        // Criar estagiário
        await addDoc(collection(db, 'estagiarios'), {
          candidatoId: candidatoSelecionado.id,
          vagaId: candidatoSelecionado.vagaId,
          nome: candidatoSelecionado.nome,
          email: candidatoSelecionado.email,
          empresa: candidatoSelecionado.vagaEmpresa || vaga?.empresa || '',
          cargo: candidatoSelecionado.vagaCargo || vaga?.cargo || '',
          gestorUid: vaga?.gestorUid || '',
          gestorNome: vaga?.gestorNome || '',
          dataInicio: dataPrevistaInicio ? new Date(dataPrevistaInicio) : serverTimestamp(),
          dataFim: new Date(new Date(dataPrevistaInicio || Date.now()).getTime() + 365 * 24 * 60 * 60 * 1000), // 1 ano
          regime: 'ESTAGIO',
          status: 'ativo',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else {
        // Criar colaborador
        await addDoc(collection(db, 'colaboradores'), {
          candidatoId: candidatoSelecionado.id,
          vagaId: candidatoSelecionado.vagaId,
          nome: candidatoSelecionado.nome,
          email: candidatoSelecionado.email,
          empresa: candidatoSelecionado.vagaEmpresa || vaga?.empresa || '',
          cargo: candidatoSelecionado.vagaCargo || vaga?.cargo || '',
          gestorUid: vaga?.gestorUid || '',
          gestorNome: vaga?.gestorNome || '',
          dataInicio: dataPrevistaInicio ? new Date(dataPrevistaInicio) : serverTimestamp(),
          regime: regime,
          status: 'ativo',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      
      // Atualizar status do candidato
      await updateDoc(doc(db, 'candidatos', candidatoSelecionado.id), {
        status: regime === 'ESTAGIO' ? 'estagiario' : 'colaborador',
        updatedAt: serverTimestamp(),
      })
      
      setFeedback('Onboarding concluído! Candidato movido para ' + (regime === 'ESTAGIO' ? 'estagiários' : 'colaboradores'))
      
      setTimeout(() => {
        setShowModal(false)
        setFeedback(null)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao finalizar onboarding.')
    }
  }

  // Contagem de dias desde a indicação (para	bônus de 90 dias)
  function diasDesdeIndicacao(candidato: Candidato): number | null {
    if (candidato.origem !== 'indicacao' || !candidato.indicacaoDataInicio) return null
    const inicio = candidato.indicacaoDataInicio.toDate ? candidato.indicacaoDataInicio.toDate() : new Date(candidato.indicacaoDataInicio as unknown as number)
    const agora = new Date()
    const diffTime = Math.abs(agora.getTime() - inicio.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Onboarding</h1>
          <p>Acompanhe o processo de integração dos candidatos aprovados.</p>
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Buscar candidato..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
      </div>

      {loading ? (
        <div className="empty-state">Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          Nenhum candidato em onboarding no momento.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Empresa</th>
                <th>Data Prevista Início</th>
                <th>Checklist</th>
                <th>Indicação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const vaga = vagas.find(v => v.id === c.vagaId)
                const dias = diasDesdeIndicacao(c)
                const checklistCompleto = c.checklistOnboarding?.every(i => i.checked) ?? false
                
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.nome}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{c.email}</div>
                    </td>
                    <td>{c.vagaCargo || vaga?.cargo || '—'}</td>
                    <td>{c.vagaEmpresa || vaga?.empresa || '—'}</td>
                    <td>
                      {c.dataPrevistaInicio 
                        ? (c.dataPrevistaInicio.toDate ? c.dataPrevistaInicio.toDate() : new Date(c.dataPrevistaInicio as unknown as number)).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td>
                      <span style={{ 
                        color: checklistCompleto ? 'var(--green-600)' : 'var(--orange-500)',
                        fontWeight: 500
                      }}>
                        {c.checklistOnboarding?.filter(i => i.checked).length || 0} / {c.checklistOnboarding?.length || 0}
                      </span>
                    </td>
                    <td>
                      {c.origem === 'indicacao' && c.indicacaoNome && (
                        <div>
                          <span className="muted" style={{ fontSize: 12 }}>Indicado por: {c.indicacaoNome}</span>
                          {dias !== null && (
                            <div style={{ fontSize: 11, color: dias > 90 ? 'var(--green-600)' : 'var(--text-muted)' }}>
                              {dias} dias (pagamento {dias > 90 ? 'disponível' : `em ${90 - dias} dias`})
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: 13 }}
                        onClick={() => abrirChecklist(c)}
                      >
                        {checklistCompleto ? 'Verificar' : 'Checklist'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de checklist */}
      {showModal && candidatoSelecionado && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h2>Checklist de Onboarding</h2>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSalvarChecklist} className="modal-body">
              {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
              {feedback && <div className="success-text" style={{ marginBottom: 12 }}>{feedback}</div>}
              
              <div style={{ marginBottom: 20 }}>
                <strong>{candidatoSelecionado.nome}</strong>
                <span className="muted"> · {candidatoSelecionado.vagaCargo || 'Vaga'}</span>
              </div>

              <div className="field full" style={{ marginBottom: 20 }}>
                <label>Data Prevista de Início</label>
                <input 
                  type="date" 
                  value={dataPrevistaInicio} 
                  onChange={(e) => setDataPrevistaInicio(e.target.value)}
                />
              </div>

              <div className="field full">
                <label>Checklist ({regimeSelecionado})</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {checklist.map((item) => (
                    <div 
                      key={item.id}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 10,
                        padding: '8px 12px',
                        background: item.checked ? 'var(--green-50)' : 'transparent',
                        borderRadius: 4,
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleChecklistItem(item.id)}
                        style={{ margin: 0 }}
                      />
                      <span style={{ flex: 1, textDecoration: item.checked ? 'line-through' : 'none' }}>
                        {item.label}
                      </span>
                      {item.id === 'agendamento' && item.checked && (
                        <input
                          type="date"
                          value={item.data || ''}
                          onChange={(e) => toggleChecklistItem(item.id, e.target.value)}
                          style={{ width: 150 }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notificação automática para o gestor quando todos os itens estiverem marcados */}
              {isChecklistCompleto() && (
                <div style={{ 
                  marginTop: 16, 
                  padding: 12, 
                  background: 'var(--green-50)', 
                  borderRadius: 4,
                  border: '1px solid var(--green-200)'
                }}>
                  <strong>✓ Checklist completo!</strong>
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                    O gestor será automaticamente notificado sobre o início do candidato.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar Checklist'}
                </button>
                {isChecklistCompleto() && (
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ background: 'var(--green-600)' }}
                    onClick={finalizarOnboarding}
                  >
                    Finalizar Onboarding
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}