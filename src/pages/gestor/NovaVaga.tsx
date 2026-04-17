import { useState, type FormEvent } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import type {
  Formacao,
  Jornada,
  MotivoAbertura,
  Nivel,
  Regime,
  TempoExperiencia,
} from '../../types'

const NIVEIS: { v: Nivel; l: string }[] = [
  { v: 'estagiario', l: 'Estagiário' },
  { v: 'trainee', l: 'Trainee' },
  { v: 'assistente', l: 'Assistente' },
  { v: 'junior', l: 'Júnior' },
  { v: 'pleno', l: 'Pleno' },
  { v: 'senior', l: 'Sênior' },
  { v: 'especialista', l: 'Especialista' },
  { v: 'coordenador', l: 'Coordenador' },
  { v: 'gerente', l: 'Gerente' },
  { v: 'outro', l: 'Outro' },
]

const REGIMES: { v: Regime; l: string }[] = [
  { v: 'PJ', l: 'PJ' },
  { v: 'CLT', l: 'CLT' },
  { v: 'ESTAGIO', l: 'Estágio' },
  { v: 'FREELANCER', l: 'Freelancer' },
]

const JORNADAS: { v: Jornada; l: string }[] = [
  { v: 'hibrido', l: 'Híbrido (3 presencial + 2 remoto)' },
  { v: 'presencial', l: 'Presencial' },
  { v: 'remoto', l: 'Remoto' },
  { v: 'outro', l: 'Outro' },
]

const EXPERIENCIAS: { v: TempoExperiencia; l: string }[] = [
  { v: 'sem_minimo', l: 'Sem tempo mínimo' },
  { v: '1_3', l: '1 a 3 anos' },
  { v: '3_5', l: '3 a 5 anos' },
  { v: '5_8', l: '5 a 8 anos' },
  { v: 'mais_8', l: 'Mais de 8 anos' },
]

const FORMACOES: { v: Formacao; l: string }[] = [
  { v: 'ensino_medio', l: 'Ensino Médio Completo' },
  { v: 'superior_incompleto', l: 'Superior Incompleto' },
  { v: 'superior_completo', l: 'Superior Completo' },
  { v: 'pos', l: 'Pós-Graduação' },
  { v: 'mestrado_doutorado', l: 'Mestrado/Doutorado' },
]

export default function NovaVaga() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [empresa, setEmpresa] = useState(profile?.empresa ?? '')
  const [cargo, setCargo] = useState('')
  const [time, setTime] = useState(profile?.area ?? '')
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

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !profile) return
    setError(null)
    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'vagas'), {
        status: 'aberta',
        cargo,
        time,
        empresa,
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
        gestorUid: user.uid,
        gestorNome: profile.name,
        gestorEmail: profile.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        historico: [
          {
            at: new Date(),
            byUid: user.uid,
            byName: profile.name,
            toStatus: 'aberta',
            nota: 'Vaga aberta pelo gestor.',
          },
        ],
      })
      navigate(`/gestor/vagas/${docRef.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Abrir nova vaga</h1>
          <p>Preencha as informações abaixo para iniciar o processo de contratação.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, background: 'var(--green-50)', borderColor: 'var(--green-100)' }}>
        <strong>Olá, parceiro ETUS =)</strong>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Após o preenchimento, entraremos em contato em até 2 dias úteis para alinhar o perfil.
          O processo inclui recrutamento (LinkedIn, Indeed, hunting e indicações), triagem,
          entrevistas (RH, gestor e cultura) e definição de remuneração e data de admissão em
          conjunto.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="row-gap-16">
        {error && <div className="error-text">{error}</div>}

        <div className="card">
          <h3>Identificação</h3>
          <div className="form-grid">
            <div className="field">
              <label>Empresa do Grupo *</label>
              <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} required />
            </div>
            <div className="field">
              <label>Nome do cargo (para divulgação) *</label>
              <input value={cargo} onChange={(e) => setCargo(e.target.value)} required />
            </div>
            <div className="field full">
              <label>Time / área em que a pessoa irá trabalhar *</label>
              <input value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Motivo da abertura</h3>
          <div className="field">
            <div className="radio-group">
              {(
                [
                  { v: 'aumento', l: 'Aumento de quadro' },
                  { v: 'substituicao', l: 'Substituição' },
                ] as { v: MotivoAbertura; l: string }[]
              ).map((opt) => (
                <label key={opt.v} className={'radio-option' + (motivo === opt.v ? ' selected' : '')}>
                  <input
                    type="radio"
                    name="motivo"
                    value={opt.v}
                    checked={motivo === opt.v}
                    onChange={() => setMotivo(opt.v)}
                  />
                  {opt.l}
                </label>
              ))}
            </div>
          </div>
          {motivo === 'substituicao' && (
            <div className="field" style={{ marginTop: 14 }}>
              <label>Nome da pessoa que será substituída *</label>
              <input
                value={substituidoNome}
                onChange={(e) => setSubstituidoNome(e.target.value)}
                required
              />
            </div>
          )}
          {motivo === 'aumento' && (
            <div className="field" style={{ marginTop: 14 }}>
              <label>Justificativa do aumento *</label>
              <span className="hint">Ex.: novos clientes, novos negócios, aumento de demanda.</span>
              <textarea
                value={justificativaAumento}
                onChange={(e) => setJustificativaAumento(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        <div className="card">
          <h3>Condições da vaga</h3>
          <div className="form-grid">
            <div className="field full">
              <label>Regime de contratação *</label>
              <div className="radio-group">
                {REGIMES.map((opt) => (
                  <label
                    key={opt.v}
                    className={'radio-option' + (regime === opt.v ? ' selected' : '')}
                  >
                    <input
                      type="radio"
                      name="regime"
                      value={opt.v}
                      checked={regime === opt.v}
                      onChange={() => setRegime(opt.v)}
                    />
                    {opt.l}
                  </label>
                ))}
              </div>
            </div>

            <div className="field full">
              <label>Nível do cargo *</label>
              <div className="radio-group">
                {NIVEIS.map((opt) => (
                  <label
                    key={opt.v}
                    className={'radio-option' + (nivel === opt.v ? ' selected' : '')}
                  >
                    <input
                      type="radio"
                      name="nivel"
                      value={opt.v}
                      checked={nivel === opt.v}
                      onChange={() => setNivel(opt.v)}
                    />
                    {opt.l}
                  </label>
                ))}
              </div>
              {nivel === 'outro' && (
                <input
                  placeholder="Descreva o nível"
                  value={nivelOutro}
                  onChange={(e) => setNivelOutro(e.target.value)}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>

            <div className="field full">
              <label>Regime de jornada *</label>
              <div className="radio-group">
                {JORNADAS.map((opt) => (
                  <label
                    key={opt.v}
                    className={'radio-option' + (jornada === opt.v ? ' selected' : '')}
                  >
                    <input
                      type="radio"
                      name="jornada"
                      value={opt.v}
                      checked={jornada === opt.v}
                      onChange={() => setJornada(opt.v)}
                    />
                    {opt.l}
                  </label>
                ))}
              </div>
              {jornada === 'outro' && (
                <input
                  placeholder="Descreva a jornada"
                  value={jornadaOutro}
                  onChange={(e) => setJornadaOutro(e.target.value)}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Perfil do candidato</h3>
          <div className="form-grid">
            <div className="field full">
              <label>Tempo de experiência profissional *</label>
              <div className="radio-group">
                {EXPERIENCIAS.map((opt) => (
                  <label
                    key={opt.v}
                    className={'radio-option' + (tempoExperiencia === opt.v ? ' selected' : '')}
                  >
                    <input
                      type="radio"
                      name="experiencia"
                      value={opt.v}
                      checked={tempoExperiencia === opt.v}
                      onChange={() => setTempoExperiencia(opt.v)}
                    />
                    {opt.l}
                  </label>
                ))}
              </div>
            </div>

            <div className="field full">
              <label>Formação acadêmica exigida *</label>
              <div className="radio-group">
                {FORMACOES.map((opt) => (
                  <label
                    key={opt.v}
                    className={'radio-option' + (formacao === opt.v ? ' selected' : '')}
                  >
                    <input
                      type="radio"
                      name="formacao"
                      value={opt.v}
                      checked={formacao === opt.v}
                      onChange={() => setFormacao(opt.v)}
                    />
                    {opt.l}
                  </label>
                ))}
              </div>
            </div>

            <div className="field full">
              <label>Cursos válidos (se houver exigência de ensino superior)</label>
              <textarea value={cursosValidos} onChange={(e) => setCursosValidos(e.target.value)} />
            </div>

            <div className="field full">
              <label>Descrição das atividades principais *</label>
              <textarea
                value={descricaoAtividades}
                onChange={(e) => setDescricaoAtividades(e.target.value)}
                required
              />
            </div>

            <div className="field full">
              <label>Requisitos técnicos obrigatórios *</label>
              <span className="hint">Descreva em tópicos.</span>
              <textarea
                value={requisitosTecnicos}
                onChange={(e) => setRequisitosTecnicos(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Estrutura e orçamento</h3>
          <div className="form-grid">
            <div className="field full">
              <label>Esta vaga está prevista no orçamento da área? *</label>
              <div className="radio-group">
                {[
                  { v: true, l: 'Sim' },
                  { v: false, l: 'Não' },
                ].map((opt) => (
                  <label
                    key={String(opt.v)}
                    className={'radio-option' + (previstaOrcamento === opt.v ? ' selected' : '')}
                  >
                    <input
                      type="radio"
                      name="orcamento"
                      checked={previstaOrcamento === opt.v}
                      onChange={() => setPrevistaOrcamento(opt.v)}
                    />
                    {opt.l}
                  </label>
                ))}
              </div>
            </div>
            <div className="field full">
              <label>Equipamentos necessários para o dia a dia</label>
              <textarea value={equipamentos} onChange={(e) => setEquipamentos(e.target.value)} />
            </div>
            <div className="field full">
              <label>Observações</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/gestor')}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar solicitação'}
          </button>
        </div>
      </form>
    </>
  )
}
