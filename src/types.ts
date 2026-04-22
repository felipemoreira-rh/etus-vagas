import type { Timestamp } from 'firebase/firestore'

// ═════════════════════════ USUÁRIOS ═════════════════════════
export type Role = 'rh' | 'gestor'

export interface UserProfile {
  uid: string
  email: string
  name: string
  role: Role
  empresa?: string
  area?: string
  createdAt?: Timestamp
}

// ═════════════════════════ MÓDULOS ═════════════════════════
export type ModuleKey = 'rh' | 'dp'

export const MODULE_LABEL: Record<ModuleKey, string> = {
  rh: 'RH — Recrutamento',
  dp: 'DP — Departamento Pessoal',
}

export const MODULE_SHORT: Record<ModuleKey, string> = {
  rh: 'RH',
  dp: 'DP',
}

// ═════════════════════════ VAGAS (RH) ═════════════════════════
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

  cargo: string
  time: string
  empresa: string

  motivo: MotivoAbertura
  substituidoNome?: string
  justificativaAumento?: string

  regime: Regime
  nivel: Nivel
  nivelOutro?: string
  jornada: Jornada
  jornadaOutro?: string

  tempoExperiencia: TempoExperiencia
  formacao: Formacao
  cursosValidos?: string
  descricaoAtividades: string
  requisitosTecnicos: string
  equipamentos?: string

  previstaOrcamento: boolean
  observacoes?: string

  gestorUid: string
  gestorNome: string
  gestorEmail: string
  responsavelRhUid?: string
  responsavelRhNome?: string

  createdAt: Timestamp
  updatedAt: Timestamp

  historico: VagaMovimentacao[]

  // SLA (opcional; calculado via createdAt)
  slaMetaDias?: number
}

// ═════════════════════════ CANDIDATOS (RH) ═════════════════════════
export type CandidatoFase =
  | 'triagem'
  | 'teste_online'
  | 'entrevista_rh'
  | 'entrevista_gestor'
  | 'entrevista_cultura'
  | 'proposta'
  | 'aprovado'
  | 'reprovado'
  | 'desistente'

export const CANDIDATO_FASE_LABEL: Record<CandidatoFase, string> = {
  triagem: 'Triagem',
  teste_online: 'Teste Online',
  entrevista_rh: 'Entrevista RH',
  entrevista_gestor: 'Entrevista Gestor',
  entrevista_cultura: 'Entrevista Cultura',
  proposta: 'Proposta',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  desistente: 'Desistente',
}

export const CANDIDATO_FASE_ORDER: CandidatoFase[] = [
  'triagem',
  'teste_online',
  'entrevista_rh',
  'entrevista_gestor',
  'entrevista_cultura',
  'proposta',
  'aprovado',
  'reprovado',
  'desistente',
]

export type CandidatoOrigem =
  | 'linkedin'
  | 'indeed'
  | 'gupy'
  | 'indicacao'
  | 'site_etus'
  | 'outro'

export const CANDIDATO_ORIGEM_LABEL: Record<CandidatoOrigem, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  gupy: 'Gupy',
  indicacao: 'Indicação',
  site_etus: 'Site ETUS',
  outro: 'Outro',
}

export interface CandidatoMovimentacao {
  at: Timestamp
  byUid: string
  byName: string
  fromFase?: CandidatoFase
  toFase?: CandidatoFase
  nota?: string
}

export interface Anexo {
  url: string
  nome: string
  path: string
  uploadedAt: Timestamp
  uploadedByUid: string
  uploadedByName: string
  tamanho?: number
  tipo?: 'curriculo' | 'relatorio' | 'outro'
}

export interface AgendamentoEntrevista {
  id: string
  titulo: string
  inicio: Timestamp
  fim: Timestamp
  participantes?: string[]
  local?: string
  observacoes?: string
  calendarUrl?: string
  criadoPorUid: string
  criadoPorNome: string
  criadoEm: Timestamp
}

export interface Candidato {
  id: string
  nome: string
  email?: string
  telefone?: string
  cidade?: string
  uf?: string
  linkedin?: string

  vagaId: string
  vagaCargo: string
  vagaGestorUid?: string

  fase: CandidatoFase
  score?: number // 0–100
  origem: CandidatoOrigem
  origemOutro?: string

  observacoes?: string
  curriculumUrl?: string
  curriculumNome?: string
  curriculumPath?: string
  relatorios?: Anexo[]
  agendamentos?: AgendamentoEntrevista[]

  createdAt: Timestamp
  updatedAt: Timestamp
  historico: CandidatoMovimentacao[]
}

// ═════════════════════════ ONBOARDING (RH) ═════════════════════════
export interface OnboardingItem {
  id: string
  titulo: string
  descricao?: string
  done: boolean
  doneAt?: Timestamp
  doneByUid?: string
  doneByName?: string
}

export interface Onboarding {
  id: string
  candidatoId: string
  candidatoNome: string
  vagaId: string
  vagaCargo: string
  empresa: string
  dataAdmissao?: Timestamp
  status: 'pendente' | 'em_andamento' | 'concluido'
  checklist: OnboardingItem[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ═════════════════════════ DP — ESTAGIÁRIOS ═════════════════════════
export interface Estagiario {
  id: string
  nome: string
  email?: string
  cpf?: string
  curso: string
  instituicao: string
  semestre?: string
  empresa: string
  area: string
  mentor?: string
  dataInicio: Timestamp
  dataTermino: Timestamp
  bolsa?: number
  status: 'ativo' | 'finalizado' | 'desligado'
  observacoes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ═════════════════════════ DP — COLABORADORES ═════════════════════════
export type RegimeTrabalho = 'clt' | 'pj' | 'estagio' | 'freelancer'

export const REGIME_TRABALHO_LABEL: Record<RegimeTrabalho, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  freelancer: 'Freelancer',
}

export interface Colaborador {
  id: string
  nome: string
  email?: string
  cpf?: string
  cargo: string
  area: string
  empresa: string
  regime: RegimeTrabalho
  dataAdmissao: Timestamp
  dataDemissao?: Timestamp
  salario?: number
  gestorUid?: string
  gestorNome?: string
  status: 'ativo' | 'ferias' | 'afastado' | 'desligado'
  experiencia?: {
    inicio: Timestamp
    fim45?: Timestamp
    fim90?: Timestamp
    resultado45?: 'positivo' | 'negativo' | 'pendente'
    resultado90?: 'positivo' | 'negativo' | 'pendente'
    observacoes?: string
  }
  observacoes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ═════════════════════════ FIN — NOTAS IFOOD ═════════════════════════
export interface NotaIfood {
  id: string
  data: Timestamp
  restaurante: string
  colaboradorUid?: string
  colaboradorNome: string
  area?: string
  empresa?: string
  valor: number
  descricao?: string
  anexoUrl?: string
  status: 'pendente' | 'aprovado' | 'pago' | 'rejeitado'
  createdAt: Timestamp
  updatedAt: Timestamp
  createdByUid: string
  createdByName: string
}

// ═════════════════════════ FIN — OUTROS PAGAMENTOS ═════════════════════════
export type PagamentoCategoria =
  | 'vale_refeicao'
  | 'mobilidade'
  | 'reembolso'
  | 'bonus'
  | 'treinamento'
  | 'equipamento'
  | 'outros'

export const PAGAMENTO_CAT_LABEL: Record<PagamentoCategoria, string> = {
  vale_refeicao: 'Vale refeição',
  mobilidade: 'Mobilidade',
  reembolso: 'Reembolso',
  bonus: 'Bônus',
  treinamento: 'Treinamento',
  equipamento: 'Equipamento',
  outros: 'Outros',
}

export interface Pagamento {
  id: string
  data: Timestamp
  descricao: string
  categoria: PagamentoCategoria
  valor: number
  colaboradorUid?: string
  colaboradorNome?: string
  area?: string
  empresa?: string
  anexoUrl?: string
  status: 'pendente' | 'aprovado' | 'pago' | 'rejeitado'
  createdAt: Timestamp
  updatedAt: Timestamp
  createdByUid: string
  createdByName: string
}

// ═════════════════════════ HELPERS ═════════════════════════
export const NIVEL_LABEL: Record<Nivel, string> = {
  estagiario: 'Estagiário',
  trainee: 'Trainee',
  assistente: 'Assistente',
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
  especialista: 'Especialista',
  coordenador: 'Coordenador',
  gerente: 'Gerente',
  outro: 'Outro',
}

export const JORNADA_LABEL: Record<Jornada, string> = {
  hibrido: 'Híbrido',
  presencial: 'Presencial',
  remoto: 'Remoto',
  outro: 'Outro',
}

export const EXP_LABEL: Record<TempoExperiencia, string> = {
  sem_minimo: 'Sem tempo mínimo',
  '1_3': '1 a 3 anos',
  '3_5': '3 a 5 anos',
  '5_8': '5 a 8 anos',
  mais_8: 'Mais de 8 anos',
}

export const FORMACAO_LABEL: Record<Formacao, string> = {
  ensino_medio: 'Ensino médio',
  superior_incompleto: 'Superior incompleto',
  superior_completo: 'Superior completo',
  pos: 'Pós-graduação',
  mestrado_doutorado: 'Mestrado / Doutorado',
}

export const REGIME_LABEL: Record<Regime, string> = {
  PJ: 'PJ',
  CLT: 'CLT',
  ESTAGIO: 'Estágio',
  FREELANCER: 'Freelancer',
}
