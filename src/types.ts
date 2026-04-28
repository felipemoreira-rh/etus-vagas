import type { Timestamp } from 'firebase/firestore'

export type Role = 'rh' | 'gestor' | 'dp'

export const EMPRESAS = [
  'ETUS',
  'EVOLUTION',
  'E3MEDIA',
  'BHAZ',
  'NONAME',
  'E3J',
  'PLUSDIN',
  'ONTU',
] as const

export type Empresa = (typeof EMPRESAS)[number]

export interface UserProfile {
  uid: string
  email: string
  name: string
  role: Role
  empresa?: string
  area?: string
  createdAt?: Timestamp
}

export type VagaStatus =
  | 'aberta'
  | 'triagem'
  | 'entrevistas'
  | 'proposta'
  | 'contratada'
  | 'pausada'
  | 'cancelada'

export const STATUS_LABELS: Record<VagaStatus, string> = {
  aberta: 'Aberta',
  triagem: 'Triagem de CVs',
  entrevistas: 'Em entrevistas',
  proposta: 'Proposta',
  contratada: 'Contratada',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
}

export const STATUS_ORDER: VagaStatus[] = [
  'aberta',
  'triagem',
  'entrevistas',
  'proposta',
  'contratada',
  'pausada',
  'cancelada',
]

export type MotivoAbertura = 'aumento' | 'substituicao'
export type Regime = 'PJ' | 'CLT' | 'ESTAGIO' | 'FREELANCER'
export type Nivel =
  | 'estagiario'
  | 'trainee'
  | 'assistente'
  | 'junior'
  | 'pleno'
  | 'senior'
  | 'especialista'
  | 'coordenador'
  | 'gerente'
  | 'outro'
export type Jornada = 'hibrido' | 'presencial' | 'remoto' | 'outro'
export type TempoExperiencia = 'sem_minimo' | '1_3' | '3_5' | '5_8' | 'mais_8'
export type Formacao =
  | 'ensino_medio'
  | 'superior_incompleto'
  | 'superior_completo'
  | 'pos'
  | 'mestrado_doutorado'

export interface VagaMovimentacao {
  at: Timestamp
  byUid: string
  byName: string
  fromStatus?: VagaStatus
  toStatus?: VagaStatus
  nota?: string
}

export interface Vaga {
  id: string
  status: VagaStatus

  // identificação
  cargo: string
  time: string
  empresa: string

  // motivo
  motivo: MotivoAbertura
  substituidoNome?: string
  justificativaAumento?: string

  // condições
  regime: Regime
  nivel: Nivel
  nivelOutro?: string
  jornada: Jornada
  jornadaOutro?: string

  // requisitos
  tempoExperiencia: TempoExperiencia
  formacao: Formacao
  cursosValidos?: string
  descricaoAtividades: string
  requisitosTecnicos: string
  equipamentos?: string

  // financeiro / obs
  previstaOrcamento: boolean
  observacoes?: string

  // metadata
  gestorUid: string
  gestorNome: string
  gestorEmail: string
  responsavelRhUid?: string
  responsavelRhNome?: string

  createdAt: Timestamp
  updatedAt: Timestamp

  historico: VagaMovimentacao[]
}

// Novos tipos para Candidatos
export type CandidatoOrigem = 'linkedin' | 'indeed' | 'indicacao' | 'casting' | 'outro'
export type CandidatoStatus = 'triagem' | 'entrevista' | 'proposta' | 'aprovado' | 'reprovado' | 'onboarding' | 'estagiario' | 'colaborador'

export const CANDIDATO_STATUS_LABELS: Record<CandidatoStatus, string> = {
  triagem: 'Em Triagem',
  entrevista: 'Em Entrevista',
  proposta: 'Proposta',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  onboarding: 'Em Onboarding',
  estagiario: 'Estagiário',
  colaborador: 'Colaborador',
}

export interface Candidato {
  id: string
  vagaId: string
  vagaCargo?: string
  vagaEmpresa?: string
  
  // dados pessoais
  nome: string
  email: string
  telefone: string
  linkedin?: string
  portfolio?: string
  pretensaoSalarial?: string
  
  // origem
  origem: CandidatoOrigem
  indicacaoNome?: string // nome de quem indicou (se origem for indicação)
  indicacaoDataInicio?: Timestamp // data de início para contar 90 dias
  indicacaoPaga?: boolean // se a indicação já foi paga
  
  // status e avaliação
  status: CandidatoStatus
  nota?: number
  observacoes?: string
  
  // onboarding
  dataPrevistaInicio?: Timestamp
  regimeContratacao?: Regime
  
  // checklist onboarding
  checklistOnboarding?: CandidatoChecklist[]
  
  // metadata
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CandidatoChecklist {
  id: string
  label: string
  checked: boolean
  data?: string // para data de agendamento
}

// Checklist padrão por regime
export const CHECKLIST_POR_REGIME: Record<Regime, CandidatoChecklist[]> = {
  CLT: [
    { id: 'proposta', label: 'Enviar proposta', checked: false },
    { id: 'documentacao', label: 'Enviar lista de documentação', checked: false },
    { id: 'fotos', label: 'Solicitar fotos e curiosidades', checked: false },
    { id: 'docs_recebidos', label: 'Documentos recebidos', checked: false },
    { id: 'contrato_juridico', label: 'Solicitação de contrato jurídico', checked: false },
    { id: 'salvar_drive', label: 'Salvar docs no drive', checked: false },
    { id: 'equipamentos', label: 'Solicitação de equipamentos e acessos', checked: false },
    { id: 'email_inicio', label: 'Envio de email de início', checked: false },
    { id: 'agendamento', label: 'Agendamento de onboarding', checked: false, data: '' },
    { id: 'notificacao_gestor', label: 'Notificação de início para gestor', checked: false },
    { id: 'beneficios', label: 'Cadastro de benefícios', checked: false },
  ],
  PJ: [
    { id: 'proposta', label: 'Enviar proposta', checked: false },
    { id: 'documentacao', label: 'Enviar lista de documentação', checked: false },
    { id: 'fotos', label: 'Solicitar fotos e curiosidades', checked: false },
    { id: 'docs_recebidos', label: 'Documentos recebidos', checked: false },
    { id: 'contrato_juridico', label: 'Solicitação de contrato jurídico', checked: false },
    { id: 'salvar_drive', label: 'Salvar docs no drive', checked: false },
    { id: 'equipamentos', label: 'Solicitação de equipamentos e acessos', checked: false },
    { id: 'email_inicio', label: 'Envio de email de início', checked: false },
    { id: 'agendamento', label: 'Agendamento de onboarding', checked: false, data: '' },
    { id: 'notificacao_gestor', label: 'Notificação de início para gestor', checked: false },
    { id: 'beneficios', label: 'Cadastro de benefícios', checked: false },
  ],
  ESTAGIO: [
    { id: 'proposta', label: 'Enviar proposta', checked: false },
    { id: 'documentacao', label: 'Enviar lista de documentação', checked: false },
    { id: 'fotos', label: 'Solicitar fotos e curiosidades', checked: false },
    { id: 'docs_recebidos', label: 'Documentos recebidos', checked: false },
    { id: 'contrato_juridico', label: 'Solicitação de contrato jurídico', checked: false },
    { id: 'salvar_drive', label: 'Salvar docs no drive', checked: false },
    { id: 'equipamentos', label: 'Solicitação de equipamentos e acessos', checked: false },
    { id: 'email_inicio', label: 'Envio de email de início', checked: false },
    { id: 'agendamento', label: 'Agendamento de onboarding', checked: false, data: '' },
    { id: 'notificacao_gestor', label: 'Notificação de início para gestor', checked: false },
    { id: 'beneficios', label: 'Cadastro de benefícios', checked: false },
    { id: 'termo_contrato', label: 'Termo de compromisso de estágio', checked: false },
  ],
  FREELANCER: [
    { id: 'proposta', label: 'Enviar proposta', checked: false },
    { id: 'documentacao', label: 'Enviar lista de documentação', checked: false },
    { id: 'fotos', label: 'Solicitar fotos e curiosidades', checked: false },
    { id: 'docs_recebidos', label: 'Documentos recebidos', checked: false },
    { id: 'contrato_juridico', label: 'Solicitação de contrato jurídico', checked: false },
    { id: 'salvar_drive', label: 'Salvar docs no drive', checked: false },
    { id: 'equipamentos', label: 'Solicitação de equipamentos e acessos', checked: false },
    { id: 'email_inicio', label: 'Envio de email de início', checked: false },
    { id: 'agendamento', label: 'Agendamento de onboarding', checked: false, data: '' },
    { id: 'notificacao_gestor', label: 'Notificação de início para gestor', checked: false },
  ],
}

// Tipos para Dashboard DP
export interface Estagiario {
  id: string
  candidatoId: string
  vagaId: string
  nome: string
  email: string
  empresa: string
  cargo: string
  gestorUid: string
  gestorNome: string
  dataInicio: Timestamp
  dataFim: Timestamp
  regime: Regime
  status: 'ativo' | 'encerrado' | 'efetivado'
  dataEfetivacao?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Colaborador {
  id: string
  candidatoId: string
  vagaId: string
  nome: string
  email: string
  empresa: string
  cargo: string
  gestorUid: string
  gestorNome: string
  dataInicio: Timestamp
  regime: Regime
  status: 'ativo' | 'demitido'
  createdAt: Timestamp
  updatedAt: Timestamp
}
