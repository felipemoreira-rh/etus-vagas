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
import { useAuth } from '../../../contexts/AuthContext'
import type { Candidato, CandidatoOrigem, CandidatoStatus, Vaga } from '../../../types'
import { CANDIDATO_STATUS_LABELS, CHECKLIST_POR_REGIME } from '../../../types'

const ORIGENS: { v: CandidatoOrigem; l: string }[] = [
  { v: 'linkedin', l: 'LinkedIn' },
  { v: 'indeed', l: 'Indeed' },
  { v: 'indicacao', l: 'Indicação' },
  { v: 'casting', l: 'Casting' },
  { v: 'outro', l: 'Outro' },
]

const STATUS_OPTIONS: CandidatoStatus[] = [
  'triagem',
  'entrevista',
  'proposta',
  'aprovado',
  'reprovado',
  'onboarding',
]

export default function Candidatos() {
  const { user, profile } = useAuth()
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [busca, setBusca] = useState('')
  const [vagaSelecionada, setVagaSelecionada] = useState<string>('all')
  const [statusSelecionado, setStatusSelecionado] = useState<CandidatoStatus | 'all'>('all')
  
  // Modal de criar/editar candidato
  const [showModal, setShowModal] = useState(false)
  const [editandoCandidato, setEditandoCandidato] = useState<Candidato | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  
  // Campos do formulário
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [pretensaoSalarial, setPretensaoSalarial] = useState('')
  const [origem, setOrigem] = useState<CandidatoOrigem>('linkedin')
  const [indicacaoNome, setIndicacaoNome] = useState('')
  const [vagaId, setVagaId] = useState('')
  const [status, setStatus] = useState<CandidatoStatus>('triagem')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    // Carregar vagas
    const qVagas = query(collection(db, 'vagas'), orderBy('createdAt', 'desc'))
    const unsubVagas = onSnapshot(qVagas, (snap) => {
      setVagas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) })))
    })

    // Carregar candidatos
    const qCandidatos = query(collection(db, 'candidatos'), orderBy('createdAt', 'desc'))
    const unsubCandidatos = onSnapshot(qCandidatos, (snap) => {
      setCandidatos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Candidato, 'id'>) })))
      setLoading(false)
    })

    return () => {
      unsubVagas()
      unsubCandidatos()
    }
  }, [])

  const filtrados = useMemo(() => {
    return candidatos.filter((c) => {
      if (vagaSelecionada !== 'all' && c.vagaId !== vagaSelecionada) return false
      if (statusSelecionado !== 'all' && c.status !== statusSelecionado) return false
      if (busca) {
        const hay = `${c.nome} ${c.email} ${c.vagaCargo || ''}`.toLowerCase()
        if (!hay.includes(busca.toLowerCase())) return false
      }
      return true
    })
  }, [candidatos, vagaSelecionada, statusSelecionado, busca])

  // Candidatos agrupados por vaga
  const candidatosPorVaga = useMemo(() => {
    const grupos: Record<string, Candidato[]> = {}
    filtrados.forEach((c) => {
      if (!grupos[c.vagaId]) {
        grupos[c.vagaId] = []
      }
      grupos[c.vagaId].push(c)
    })
    return grupos
  }, [filtrados])

  function abrirModalCriar(vagaIdParam?: string) {
    setEditandoCandidato(null)
    setNome('')
    setEmail('')
    setTelefone('')
    setLinkedin('')
    setPortfolio('')
    setPretensaoSalarial('')
    setOrigem('linkedin')
    setIndicacaoNome('')
    setVagaId(vagaIdParam || '')
    setStatus('triagem')
    setObservacoes('')
    setError(null)
    setFeedback(null)
    setShowModal(true)
  }

  function abrirModalEditar(candidato: Candidato) {
    setEditandoCandidato(candidato)
    setNome(candidato.nome)
    setEmail(candidato.email)
    setTelefone(candidato.telefone)
    setLinkedin(candidato.linkedin || '')
    setPortfolio(candidato.portfolio || '')
    setPretensaoSalarial(candidato.pretensaoSalarial || '')
    setOrigem(candidato.origem)
    setIndicacaoNome(candidato.indicacaoNome || '')
    setVagaId(candidato.vagaId)
    setStatus(candidato.status)
    setObservacoes(candidato.observacoes || '')
    setError(null)
    setFeedback(null)
    setShowModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !profile) return
    if (!vagaId) {
      setError('Selecione uma vaga.')
      return
    }

    setSaving(true)
    setError(null)
    setFeedback(null)

    try {
      const vaga = vagas.find((v) => v.id === vagaId)
      
      if (editandoCandidato) {
        // Editar candidato existente
        await updateDoc(doc(db, 'candidatos', editandoCandidato.id), {
          nome,
          email,
          telefone,
          linkedin,
          portfolio,
          pretensaoSalarial,
          origem,
          indicacaoNome: origem === 'indicacao' ? indicacaoNome : '',
          vagaId,
          vagaCargo: vaga?.cargo,
          vagaEmpresa: vaga?.empresa,
          status,
          observacoes,
          updatedAt: serverTimestamp(),
        })
        setFeedback('Candidato atualizado com sucesso.')
      } else {
        // Criar novo candidato
        await addDoc(collection(db, 'candidatos'), {
          nome,
          email,
          telefone,
          linkedin,
          portfolio,
          pretensaoSalarial,
          origem,
          indicacaoNome: origem === 'indicacao' ? indicacaoNome : '',
          indicacaoDataInicio: origem === 'indicacao' ? serverTimestamp() : null,
          indicacaoPaga: false,
          vagaId,
          vagaCargo: vaga?.cargo,
          vagaEmpresa: vaga?.empresa,
          status: 'triagem', // Sempre começa em triagem
          observacoes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        setFeedback('Candidato criado com sucesso.')
      }
      
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

  async function atualizarStatus(candidato: Candidato, novoStatus: CandidatoStatus) {
    try {
      // Se o candidato for marcado como aprovado, mover automaticamente para onboarding
      const statusFinal: CandidatoStatus = novoStatus === 'aprovado' ? 'onboarding' : novoStatus
      
      console.log('Atualizando status:', { 
        candidatoId: candidato.id, 
        de: candidato.status, 
        para: statusFinal 
      })
      
      const updateData: Record<string, unknown> = {
        status: statusFinal,
        updatedAt: serverTimestamp(),
      }
      
      // Se está entrando em onboarding, adicionar checklist padrão
      if (statusFinal === 'onboarding') {
        const vaga = vagas.find(v => v.id === candidato.vagaId)
        const regime = vaga?.regime || 'CLT'
        updateData.checklistOnboarding = CHECKLIST_POR_REGIME[regime]
        console.log('Adicionando checklist para regime:', regime)
      }
      
      await updateDoc(doc(db, 'candidatos', candidato.id), updateData)
      console.log('Status atualizado com sucesso para:', statusFinal)
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Candidatos</h1>
          <p>Gerencie os candidatos por vaga.</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModalCriar()}>
          + Novo Candidato
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Buscar candidato..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={vagaSelecionada} onChange={(e) => setVagaSelecionada(e.target.value)}>
          <option value="all">Todas as vagas</option>
          {vagas.map((v) => (
            <option key={v.id} value={v.id}>
              {v.cargo} - {v.empresa}
            </option>
          ))}
        </select>
        <select value={statusSelecionado} onChange={(e) => setStatusSelecionado(e.target.value as CandidatoStatus | 'all')}>
          <option value="all">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {CANDIDATO_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty-state">Carregando…</div>
      ) : Object.keys(candidatosPorVaga).length === 0 ? (
        <div className="empty-state">
          <p>Nenhum candidato encontrado.</p>
          <button className="btn btn-primary" onClick={() => abrirModalCriar()}>
            + Adicionar primeiro candidato
          </button>
        </div>
      ) : (
        Object.entries(candidatosPorVaga).map(([vagaId, lista]) => {
          const vaga = vagas.find((v) => v.id === vagaId)
          return (
            <div key={vagaId} className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{vaga?.cargo || 'Vaga não encontrada'}</h3>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {vaga?.empresa} · {vaga?.regime}
                  </span>
                </div>
                <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => abrirModalCriar(vagaId)}>
                  + Adicionar Candidato
                </button>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Telefone</th>
                    <th>Origem</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.nome}</td>
                      <td>{c.email}</td>
                      <td>{c.telefone}</td>
                      <td>
                        {c.origem === 'indicacao' && c.indicacaoNome 
                          ? `Indicação (${c.indicacaoNome})` 
                          : ORIGENS.find(o => o.v === c.origem)?.l || c.origem}
                      </td>
                      <td>
                        <select
                          value={c.status}
                          onChange={(e) => atualizarStatus(c, e.target.value as CandidatoStatus)}
                          style={{ padding: '4px 8px', fontSize: 12 }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {CANDIDATO_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => abrirModalEditar(c)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      )}

      {/* Modal de criar/editar candidato */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>{editandoCandidato ? 'Editar Candidato' : 'Novo Candidato'}</h2>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
              {feedback && <div className="success-text" style={{ marginBottom: 12 }}>{feedback}</div>}
              
              <div className="form-grid">
                <div className="field full">
                  <label>Vaga *</label>
                  <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} required>
                    <option value="">Selecione uma vaga</option>
                    {vagas.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.cargo} - {v.empresa}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="field">
                  <label>Nome *</label>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                
                <div className="field">
                  <label>Telefone *</label>
                  <input value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
                </div>
                <div className="field">
                  <label>LinkedIn</label>
                  <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                </div>
                
                <div className="field">
                  <label>Portfolio</label>
                  <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
                </div>
                <div className="field">
                  <label>Pretensão Salarial</label>
                  <input value={pretensaoSalarial} onChange={(e) => setPretensaoSalarial(e.target.value)} />
                </div>
                
                <div className="field full">
                  <label>Origem *</label>
                  <select value={origem} onChange={(e) => setOrigem(e.target.value as CandidatoOrigem)}>
                    {ORIGENS.map((o) => (
                      <option key={o.v} value={o.v}>{o.l}</option>
                    ))}
                  </select>
                </div>
                
                {origem === 'indicacao' && (
                  <div className="field full">
                    <label>Nome de quem indicou *</label>
                    <input 
                      value={indicacaoNome} 
                      onChange={(e) => setIndicacaoNome(e.target.value)} 
                      required 
                      placeholder="Nome de quem indicou"
                    />
                  </div>
                )}
                
                {editandoCandidato && (
                  <div className="field full">
                    <label>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as CandidatoStatus)}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{CANDIDATO_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="field full">
                  <label>Observações</label>
                  <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando…' : editandoCandidato ? 'Salvar' : 'Criar Candidato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}