import { useEffect, useState, type FormEvent } from 'react'
import { arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { Link, useParams } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../../components/StatusBadge'
import VagaDetalheView from '../shared/VagaDetalheView'
import { STATUS_LABELS, STATUS_ORDER, EMPRESAS, type Vaga, type VagaStatus, type Regime, type Nivel, type Jornada, type MotivoAbertura, type TempoExperiencia, type Formacao, type Candidato } from '../../types'

export default function VagaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modo de edição
  const [editMode, setEditMode] = useState(false)
  
  // Campos editáveis
  const [empresas, setEmpresas] = useState<string[]>([])
  const [cargo, setCargo] = useState('')
  const [time, setTime] = useState('')
  const [motivo, setMotivo] = useState<MotivoAbertura>('aumento')
  const [substituidoNome, setSubstituidoNome] = useState('')
  const [justificativaAumento, setJustificativaAumento] = useState('')
  const [regime, setRegime] = useState<Regime>('CLT')
  const [nivel, setNivel] = useState<Nivel>('pleno')
  const [nivelOutro, setNivelOutro] = useState('')
  const [jornada, setJornada] = useState<Jornada>('hibrido')
  const [jornadaOutro, setJornadaOutro] = useState('')
  const [tempoExperiencia, setTempoExperiencia] = useState<TempoExperiencia>('sem_minimo')
  const [formacao, setFormacao] = useState<Formacao>('superior_completo')
  const [cursosValidos, setCursosValidos] = useState('')
  const [descricaoAtividades, setDescricaoAtividades] = useState('')
  const [requisitosTecnicos, setRequisitosTecnicos] = useState('')
  const [equipamentos, setEquipamentos] = useState('')
  const [previstaOrcamento, setPrevistaOrcamento] = useState(true)
  const [observacoes, setObservacoes] = useState('')

  const [novoStatus, setNovoStatus] = useState<VagaStatus>('aberta')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'vagas', id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...(snap.data() as Omit<Vaga, 'id'>) }
        setVaga(data)
        setNovoStatus(data.status)
        // Inicializar campos editáveis
        setEmpresas(data.empresa ? data.empresa.split(',').map(e => e.trim()) : [])
        setCargo(data.cargo || '')
        setTime(data.time || '')
        setMotivo(data.motivo || 'aumento')
        setSubstituidoNome(data.substituidoNome || '')
        setJustificativaAumento(data.justificativaAumento || '')
        setRegime(data.regime || 'CLT')
        setNivel(data.nivel || 'pleno')
        setNivelOutro(data.nivelOutro || '')
        setJornada(data.jornada || 'hibrido')
        setJornadaOutro(data.jornadaOutro || '')
        setTempoExperiencia(data.tempoExperiencia || 'sem_minimo')
        setFormacao(data.formacao || 'superior_completo')
        setCursosValidos(data.cursosValidos || '')
        setDescricaoAtividades(data.descricaoAtividades || '')
        setRequisitosTecnicos(data.requisitosTecnicos || '')
        setEquipamentos(data.equipamentos || '')
        setPrevistaOrcamento(data.previstaOrcamento ?? true)
        setObservacoes(data.observacoes || '')
      } else {
        setVaga(null)
      }
      setLoading(false)
    })
    return unsub
  }, [id])

  // Carregar candidatos da vaga
  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'candidatos'), where('vagaId', '==', id))
    const unsub = onSnapshot(q, (snap) => {
      setCandidatos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Candidato, 'id'>) })))
    })
    return unsub
  }, [id])

  function toggleEmpresa(emp: string) {
    setEmpresas(prev => 
      prev.includes(emp) 
        ? prev.filter(e => e !== emp)
        : [...prev, emp]
    )
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault()
    if (!vaga || !user || !profile) return
    
    setSaving(true)
    setError(null)
    setFeedback(null)
    
    try {
      await updateDoc(doc(db, 'vagas', vaga.id), {
        empresa: empresas.join(', '),
        cargo,
        time,
        motivo,
        substituidoNome: motivo === 'substituicao' ? substituidoNome : '',
        justificativaAbertura: motivo === 'aumento' ? justificativaAumento : '',
        regime,
        nivel,
        nivelOutro: nivel === 'outro' ? nivelOutro : '',
        jornada,
        jornadaOutro: jornada === 'outro' ? jornadaOutro : '',
        tempoExperiencia,
        formacao,
        cursosValidos,
        descricaoAtividades,
        requisitosTecnicos,
        equipamentos,
        previstaOrcamento,
        observacoes,
        updatedAt: serverTimestamp(),
      })
      setFeedback('Vaga atualizada com sucesso.')
      setEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function atualizarStatus(e: FormEvent) {
    e.preventDefault()
    if (!vaga || !user || !profile) return
    setSaving(true)
    setError(null)
    setFeedback(null)
    try {
      // Criar objeto de movimentação com todos os campos obrigatórios
      const movimentacao = {
        at: Timestamp.now(),
        byUid: user.uid,
        byName: profile.name,
        fromStatus: vaga.status,
        toStatus: novoStatus,
        nota: nota || '',
      }
      
      await updateDoc(doc(db, 'vagas', vaga.id), {
        status: novoStatus,
        updatedAt: serverTimestamp(),
        responsavelRhUid: user.uid,
        responsavelRhNome: profile.name,
        historico: arrayUnion(movimentacao),
      })
      setNota('')
      setFeedback('Status atualizado com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="empty-state">Carregando…</div>
  if (!vaga) return <div className="empty-state">Vaga não encontrada.</div>

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/rh/vagas" className="muted" style={{ fontSize: 13 }}>
            ← Voltar para todas as vagas
          </Link>
          <h1 style={{ marginTop: 8 }}>{vaga.cargo}</h1>
          <p>
            {vaga.empresa} · {vaga.time} · Gestor: {vaga.gestorNome}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={vaga.status} />
          {!editMode && (
            <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
              Editar Vaga
            </button>
          )}
        </div>
      </div>

      {/* Formulário de edição da vaga */}
      {editMode && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>
          <h3>Editar Vaga</h3>
          {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
          {feedback && <div className="success-text" style={{ marginBottom: 10 }}>{feedback}</div>}
          <form onSubmit={salvarEdicao} className="form-grid">
            <div className="field full">
              <label>Empresas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {EMPRESAS.map((emp) => (
                  <label
                    key={emp}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: empresas.includes(emp) ? 'var(--blue-100)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={empresas.includes(emp)}
                      onChange={() => toggleEmpresa(emp)}
                      style={{ marginRight: 6 }}
                    />
                    {emp}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Cargo</label>
              <input value={cargo} onChange={(e) => setCargo(e.target.value)} required />
            </div>
            <div className="field">
              <label>Time / Área</label>
              <input value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
            <div className="field full">
              <label>Descrição das Atividades</label>
              <textarea value={descricaoAtividades} onChange={(e) => setDescricaoAtividades(e.target.value)} required rows={4} />
            </div>
            <div className="field full">
              <label>Requisitos Técnicos</label>
              <textarea value={requisitosTecnicos} onChange={(e) => setRequisitosTecnicos(e.target.value)} required rows={3} />
            </div>
            <div className="field full">
              <label>Observações</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
            <div className="full" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Movimentação de status */}
      <div className="card" style={{ marginBottom: 20, background: 'var(--green-50)', borderColor: 'var(--green-100)' }}>
        <h3>Movimentar status</h3>
        {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
        {feedback && <div className="success-text" style={{ marginBottom: 10 }}>{feedback}</div>}
        <form onSubmit={atualizarStatus} className="form-grid">
          <div className="field">
            <label>Novo status</label>
            <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value as VagaStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Registrar nota (opcional)</label>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ex.: Aguardando retorno do candidato final."
            />
          </div>
          <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving || novoStatus === vaga.status && !nota}>
              {saving ? 'Salvando…' : 'Salvar movimentação'}
            </button>
          </div>
        </form>
      </div>

      {/* Candidatos da vaga */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Candidatos ({candidatos.length})</h3>
          <Link to={`/rh/candidatos?vaga=${vaga.id}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
            + Adicionar Candidato
          </Link>
        </div>
        {candidatos.length === 0 ? (
          <div className="muted">Nenhum candidato nesta vaga ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Origem</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidatos.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nome}</td>
                  <td>{c.email}</td>
                  <td>{c.origem === 'indicacao' && c.indicacaoNome ? `Indicação (${c.indicacaoNome})` : c.origem}</td>
                  <td>{c.status}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/rh/candidatos?edit=${c.id}`} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <VagaDetalheView vaga={vaga} />
    </>
  )
}
