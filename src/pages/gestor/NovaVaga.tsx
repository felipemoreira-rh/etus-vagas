import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type {
  Formacao,
  Jornada,
  MotivoAbertura,
  Nivel,
  Regime,
  TempoExperiencia,
  VagaMovimentacao,
} from '../../types'
import { EMPRESA_OPTIONS } from '../../types'

export default function NovaVaga() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Pre-fill com a empresa do perfil só se ela estiver na lista oficial.
  // O campo agora aceita múltiplas empresas (ex.: vaga aberta na ETUS e
  // também na PLUSDIN); guardamos no Firestore como `empresas: string[]`.
  const initialEmpresas = profile?.empresa && (EMPRESA_OPTIONS as readonly string[]).includes(profile.empresa)
    ? [profile.empresa]
    : []
  const [empresas, setEmpresas] = useState<string[]>(initialEmpresas)
  function toggleEmpresa(emp: string) {
    setEmpresas(prev => prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp])
  }
  const [cargo, setCargo] = useState('')
  const [time, setTime] = useState(profile?.area || '')
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const inicial: VagaMovimentacao = {
        at: Timestamp.now(),
        byUid: profile.uid,
        byName: profile.name,
        toStatus: 'aberta',
        nota: 'Vaga aberta pelo gestor.',
      }
      const ref = await addDoc(collection(db, 'vagas'), {
        status: 'aberta',
        cargo,
        time,
        // Novo formato (multi). Mantemos `empresa` (string) populado com a
        // primeira selecionada só pra compat com listagens/filtros antigos.
        empresas,
        empresa: empresas[0],
        motivo,
        substituidoNome: motivo === 'substituicao' ? substituidoNome : '',
        justificativaAumento: motivo === 'aumento' ? justificativaAumento : '',
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
        gestorUid: profile.uid,
        gestorNome: profile.name,
        gestorEmail: profile.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        historico: [inicial],
      })
      navigate(`/gestor/vagas/${ref.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar vaga.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Topbar title="Abrir nova vaga" icon="＋" />
      <div className="content">
        <div className="notif info">
          Este formulário é a primeira etapa do processo. Após o envio, o Time de Gente entra em contato em até 2 dias úteis para alinhamento do perfil.
        </div>

        <form onSubmit={handleSubmit} className="row-gap-14">
          {error && <div className="error-text">{error}</div>}

          <div className="panel">
            <h3>Identificação</h3>
            <div className="form-grid">
              <div className="field full">
                <label>Empresas do Grupo * <span style={{ color: 'var(--mut)', fontWeight: 400, fontSize: 11 }}>(marque uma ou mais)</span></label>
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
                <label>Nome do cargo (para divulgação) *</label>
                <input value={cargo} onChange={(e) => setCargo(e.target.value)} required placeholder="Ex.: Analista de Retenção Jr." />
              </div>
              <div className="field full">
                <label>Time / Área *</label>
                <input value={time} onChange={(e) => setTime(e.target.value)} required placeholder="Ex.: Customer Success" />
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Motivo da abertura</h3>
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
                <label>Justifique os motivos que levaram ao aumento *</label>
                <textarea
                  value={justificativaAumento}
                  onChange={(e) => setJustificativaAumento(e.target.value)}
                  required
                  placeholder="Ex.: novos clientes, novos negócios, etc."
                />
              </div>
            )}
          </div>

          <div className="panel">
            <h3>Condições da vaga</h3>
            <div className="form-grid">
              <div className="field">
                <label>Regime *</label>
                <div className="radio-group">
                  {(['CLT','PJ','ESTAGIO','FREELANCER'] as Regime[]).map(r => (
                    <label key={r} className={'radio-option' + (regime === r ? ' selected' : '')}>
                      <input type="radio" checked={regime === r} onChange={() => setRegime(r)} />
                      {r === 'ESTAGIO' ? 'Estágio' : r === 'FREELANCER' ? 'Freelancer' : r}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Nível *</label>
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
                {nivel === 'outro' && (
                  <input
                    value={nivelOutro}
                    onChange={(e) => setNivelOutro(e.target.value)}
                    placeholder="Descreva o nível"
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>
              <div className="field">
                <label>Jornada *</label>
                <select value={jornada} onChange={(e) => setJornada(e.target.value as Jornada)}>
                  <option value="hibrido">Híbrido (3 presencial + 2 remoto)</option>
                  <option value="presencial">Presencial</option>
                  <option value="remoto">Remoto</option>
                  <option value="outro">Outro</option>
                </select>
                {jornada === 'outro' && (
                  <input
                    value={jornadaOutro}
                    onChange={(e) => setJornadaOutro(e.target.value)}
                    placeholder="Descreva a jornada"
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>
              <div className="field">
                <label>Tempo de experiência *</label>
                <select value={tempoExperiencia} onChange={(e) => setTempoExperiencia(e.target.value as TempoExperiencia)}>
                  <option value="sem_minimo">Sem tempo mínimo</option>
                  <option value="1_3">1 a 3 anos</option>
                  <option value="3_5">3 a 5 anos</option>
                  <option value="5_8">5 a 8 anos</option>
                  <option value="mais_8">Mais de 8 anos</option>
                </select>
              </div>
              <div className="field">
                <label>Formação *</label>
                <select value={formacao} onChange={(e) => setFormacao(e.target.value as Formacao)}>
                  <option value="ensino_medio">Ensino médio</option>
                  <option value="superior_incompleto">Superior incompleto</option>
                  <option value="superior_completo">Superior completo</option>
                  <option value="pos">Pós-graduação</option>
                  <option value="mestrado_doutorado">Mestrado / Doutorado</option>
                </select>
              </div>
              <div className="field">
                <label>Prevista no orçamento? *</label>
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
                <label>Cursos válidos (opcional)</label>
                <input value={cursosValidos} onChange={(e) => setCursosValidos(e.target.value)} placeholder="Ex.: Administração, Engenharia, Marketing" />
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Perfil e requisitos</h3>
            <div className="form-grid">
              <div className="field full">
                <label>Descrição das atividades principais *</label>
                <textarea value={descricaoAtividades} onChange={(e) => setDescricaoAtividades(e.target.value)} required />
              </div>
              <div className="field full">
                <label>Requisitos técnicos obrigatórios * (descreva em tópicos)</label>
                <textarea value={requisitosTecnicos} onChange={(e) => setRequisitosTecnicos(e.target.value)} required />
              </div>
              <div className="field full">
                <label>Equipamentos necessários (opcional)</label>
                <textarea value={equipamentos} onChange={(e) => setEquipamentos(e.target.value)} />
              </div>
              <div className="field full">
                <label>Observações (opcional)</label>
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/gestor/minhas-vagas')}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Abrir vaga'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
