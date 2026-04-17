import type { Timestamp } from 'firebase/firestore'

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
