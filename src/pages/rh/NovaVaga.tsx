import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, onSnapshot, query, serverTimestamp, Timestamp, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type {
  Formacao, Jornada, MotivoAbertura, Nivel, Regime,
  TempoExperiencia, UserProfile, VagaMovimentacao,
} from '../../types'
import { EMPRESA_OPTIONS } from '../../types'

/**
 * Fluxo RH: pode abrir vaga diretamente em nome de um gestor (ou sem gestor vinculado).
 */
export default function RhNovaVaga() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [gestores, setGestores] = useState<UserProfile[]>([])
  const [gestorUid, setGestorUid] = useState<string>('')

  // Multi-empresa: vaga pode estar aberta em mais de uma empresa do grupo.
  const [empresas, setEmpresas] = useState<string[]>([])
  function toggleEmpresa(emp: string) {
    setEmpresas(prev => prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp])
  }
  const [cargo, setCargo] = useState('')
  const [time, setTime] = useState('')
  const [motivo, setMotivo] = useState<MotivoAbertura>('aumento')
  const [substituidoNome, setSubstituidoNome] = useState('')
  const [justificativaAumento, setJustificativaAumento] = useState('')
  const [regime, setRegime] = useState<Regime>('CLT')
  const [nivel, setNivel] = useState<Nivel>('pleno')
  const [jornada, setJornada] = useState<Jornada>('hibrido')
  const [tempoExperiencia, setTempoExperiencia] = useState<TempoExperiencia>('sem_minimo')
  const [formacao, setFormacao] = useState<Formacao>('superior_completo')
  const [cursosValidos, setCursosValidos] = useState('')
  const [descricaoAtividades, setDescricaoAtividades] = useState('')
  const [requisitosTecnicos, setRequisitosTecnicos] = useState('')
  const [equipamentos, setEquipamentos] = useState('')
  const [previstaOrcamento, setPrevistaOrcamento] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'gestor'))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setGestores(list)
    })
    return unsub
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (empresas.length === 0) {
      setError('Selecione pelo menos uma empresa do grupo.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      // Se o RH selecionou "(não vincular)", deixamos os campos vazios em vez
      // de usar o próprio RH como gestor — senão as regras de Firestore pro
      // gestor (vagaGestorUid == request.auth.uid) esconderiam candidatos
      // dessa vaga de todos os gestores reais e o RH acabaria aparecendo
      // como "gestor" na tela de detalhe da vaga.
      const g = gestores.find(x => x.uid === gestorUid)
      const gUid = g?.uid ?? ''
      const gName = g?.name ?? ''
      const gEmail = g?.email ?? ''
      const inicial: VagaMovimentacao = {
        at: Timestamp.now(),
        byUid: profile.uid,
        byName: profile.name,
        toStatus: 'aberta',
        nota: 'Vaga cadastrada pelo RH.',
      }
      const ref = await addDoc(collection(db, 'vagas'), {
        status: 'aberta',
        cargo, time,
        empresas,
        empresa: empresas[0],
        motivo,
        substituidoNome: motivo === 'substituicao' ? substituidoNome : '',
        justificativaAumento: motivo === 'aumento' ? justificativaAumento : '',
        regime, nivel, jornada, tempoExperiencia, formacao,
        cursosValidos, descricaoAtividades, requisitosTecnicos, equipamentos,
        previstaOrcamento, observacoes,
        gestorUid: gUid, gestorNome: gName, gestorEmail: gEmail,
        responsavelRhUid: profile.uid, responsavelRhNome: profile.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        historico: [inicial],
      })
      navigate(`/rh/vagas/${ref.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar vaga.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Topbar title="Nova vaga (RH)" icon="＋" />
      <div className="content">
        <form onSubmit={handleSubmit} className="row-gap-14">
          {error && <div className="error-text">{error}</div>}

          <div className="panel">
            <h3>Identificação</h3>
            <div className="form-grid">
              <div className="field full">
                <label>Empresas * <span style={{ color: 'var(--mut)', fontWeight: 400, fontSize: 11 }}>(marque uma ou mais)</span></label>
                <div className="checkbox-grid">
                  {EMPRESA_OPTIONS.map(emp => (
                    <label key={emp} className={'checkbox-option' + (empresas.includes(emp) ? ' selected' : '')}>
                      <input
                        type="checkbox"
                        checked={empresas.includes(emp)}
                        onChange={() => toggleEmpresa(emp)}
                      />
                      {emp}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Cargo (divulgação) *</label>
                <input value={cargo} onChange={(e) => setCargo(e.target.value)} required />
              </div>
              <div className="field">
                <label>Time / Área *</label>
                <input value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
              <div className="field">
                <label>Gestor responsável</label>
                <select value={gestorUid} onChange={(e) => setGestorUid(e.target.value)}>
                  <option value="">— (não vincular) —</option>
                  {gestores.map(g => (
                    <option key={g.uid} value={g.uid}>{g.name} · {g.email}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Motivo</h3>
            <div className="radio-group" style={{ marginBottom: 14 }}>
              {([
                { v: 'aumento', l: 'Aumento de quadro' },
                { v: 'substituicao', l: 'Substituição' },
              ] as { v: MotivoAbertura; l: string }[]).map(opt => (
                <label key={opt.v} className={'radio-option' + (motivo === opt.v ? ' selected' : '')}>
                  <input type="radio" checked={motivo === opt.v} onChange={() => setMotivo(opt.v)} />
                  {opt.l}
                </label>
              ))}
            </div>
            {motivo === 'substituicao' ? (
              <div className="field">
                <label>Nome da pessoa substituída *</label>
                <input value={substituidoNome} onChange={(e) => setSubstituidoNome(e.target.value)} required />
              </div>
            ) : (
              <div className="field">
                <label>Justificativa *</label>
                <textarea value={justificativaAumento} onChange={(e) => setJustificativaAumento(e.target.value)} required />
              </div>
            )}
          </div>

          <div className="panel">
            <h3>Condições</h3>
            <div className="form-grid">
              <div className="field">
                <label>Regime</label>
                <select value={regime} onChange={(e) => setRegime(e.target.value as Regime)}>
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="ESTAGIO">Estágio</option>
                  <option value="FREELANCER">Freelancer</option>
                </select>
              </div>
              <div className="field">
                <label>Nível</label>
                <select value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
                  <option value="estagiario">Estagiário</option>
                  <option value="trainee">Trainee</option>
                  <option value="assistente">Assistente</option>
                  <option value="junior">Júnior</option>
                  <option value="pleno">Pleno</option>
                  <option value="senior">Sênior</option>
                  <option value="especialista">Especialista</option>
                  <option value="coordenador">Coordenador</option>
                  <option value="gerente">Gerente</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="field">
                <label>Jornada</label>
                <select value={jornada} onChange={(e) => setJornada(e.target.value as Jornada)}>
                  <option value="hibrido">Híbrido</option>
                  <option value="presencial">Presencial</option>
                  <option value="remoto">Remoto</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="field">
                <label>Experiência</label>
                <select value={tempoExperiencia} onChange={(e) => setTempoExperiencia(e.target.value as TempoExperiencia)}>
                  <option value="sem_minimo">Sem tempo mínimo</option>
                  <option value="1_3">1 a 3 anos</option>
                  <option value="3_5">3 a 5 anos</option>
                  <option value="5_8">5 a 8 anos</option>
                  <option value="mais_8">Mais de 8 anos</option>
                </select>
              </div>
              <div className="field">
                <label>Formação</label>
                <select value={formacao} onChange={(e) => setFormacao(e.target.value as Formacao)}>
                  <option value="ensino_medio">Ensino médio</option>
                  <option value="superior_incompleto">Superior incompleto</option>
                  <option value="superior_completo">Superior completo</option>
                  <option value="pos">Pós-graduação</option>
                  <option value="mestrado_doutorado">Mestrado / Doutorado</option>
                </select>
              </div>
              <div className="field">
                <label>Prevista no orçamento?</label>
                <div className="radio-group">
                  <label className={'radio-option' + (previstaOrcamento ? ' selected' : '')}>
                    <input type="radio" checked={previstaOrcamento} onChange={() => setPrevistaOrcamento(true)} /> Sim
                  </label>
                  <label className={'radio-option' + (!previstaOrcamento ? ' selected' : '')}>
                    <input type="radio" checked={!previstaOrcamento} onChange={() => setPrevistaOrcamento(false)} /> Não
                  </label>
                </div>
              </div>
              <div className="field full">
                <label>Cursos válidos</label>
                <input value={cursosValidos} onChange={(e) => setCursosValidos(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Perfil e requisitos</h3>
            <div className="form-grid">
              <div className="field full">
                <label>Atividades principais *</label>
                <textarea value={descricaoAtividades} onChange={(e) => setDescricaoAtividades(e.target.value)} required />
              </div>
              <div className="field full">
                <label>Requisitos técnicos *</label>
                <textarea value={requisitosTecnicos} onChange={(e) => setRequisitosTecnicos(e.target.value)} required />
              </div>
              <div className="field full">
                <label>Equipamentos</label>
                <textarea value={equipamentos} onChange={(e) => setEquipamentos(e.target.value)} />
              </div>
              <div className="field full">
                <label>Observações</label>
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/rh/vagas')}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Salvando…' : 'Abrir vaga'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
