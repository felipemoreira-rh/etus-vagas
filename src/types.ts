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

// ═════════════════════════ EMPRESAS DO GRUPO ═════════════════════════
// Lista fixa de empresas pra padronizar marcação em vagas, candidatos, etc.
export const EMPRESA_OPTIONS = [
  'ETUS',
  'EVOLUTION',
  'E3MEDIA',
  'BHAZ',
  'NONAME',
  'E3J',
  'PLUSDIN',
  'ONTU',
] as const
export type Empresa = (typeof EMPRESA_OPTIONS)[number]

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
  // Quando origem === 'indicacao': nome de quem indicou (referrer).
  indicadoPorNome?: string
  indicadoPorUid?: string

  observacoes?: string
  curriculumUrl?: string
  curriculumNome?: string
  curriculumPath?: string
  relatorios?: Anexo[]
  agendamentos?: AgendamentoEntrevista[]

  // Preenchido quando o candidato é movido pra fase 'aprovado' (modal data prevista).
  // Usado para: criar onboarding, calcular countdown de 90d para bônus de indicação,
  // popular dataInicio do estagiário/colaborador ao concluir o onboarding.
  dataPrevistaInicio?: Timestamp
  dataAdmissao?: Timestamp

  createdAt: Timestamp
  updatedAt: Timestamp
  historico: CandidatoMovimentacao[]
}

// ═════════════════════════ ONBOARDING TIPOS ═════════════════════════
// Cada tipo de contrato tem um checklist diferente. Mapeamos a partir do
// regime da vaga, mas guardamos no Onboarding também pra que mudanças no
// regime da vaga depois não quebrem o checklist em andamento.
export type OnboardingTipo = 'CLT' | 'PJ' | 'ESTAGIO' | 'FREELANCER'

export const ONBOARDING_TIPO_LABEL: Record<OnboardingTipo, string> = {
  CLT: 'CLT',
  PJ: 'PJ',
  ESTAGIO: 'Estágio',
  FREELANCER: 'Freelancer',
}

// Templates por tipo. Cada template define o checklist específico daquele
// regime. Itens compartilhados aparecem em todos os tipos.
export const ONBOARDING_CHECKLIST_TEMPLATES: Record<OnboardingTipo, string[]> = {
  CLT: [
    'Documentos admissionais recebidos (RG, CPF, CTPS, comprovantes)',
    'Exame admissional realizado',
    'Cadastro no eSocial',
    'Criação de e-mail corporativo',
    'Acesso às ferramentas internas (Slack, Jira, GDrive)',
    'Entrega de equipamentos (notebook, periféricos)',
    'Cadastro no plano de saúde / odontológico',
    'Cadastro no VR/VA / iFood',
    'Cadastro no Vale Transporte',
    'Apresentação ao time',
    'Treinamento de integração',
  ],
  PJ: [
    'Contrato PJ assinado',
    'CNPJ e dados bancários cadastrados',
    'Criação de e-mail corporativo',
    'Acesso às ferramentas internas (Slack, Jira, GDrive)',
    'Entrega de equipamentos (se aplicável)',
    'Cadastro no iFood / benefícios',
    'Apresentação ao time',
    'Treinamento de integração',
  ],
  ESTAGIO: [
    'TCE (Termo de Compromisso de Estágio) assinado',
    'Documentos do estágio recebidos (RG, CPF, comprovante de matrícula)',
    'Apolice de seguro de estágio ativa',
    'Plano de atividades pedagógicas definido',
    'Criação de e-mail corporativo',
    'Acesso às ferramentas internas (Slack, GDrive)',
    'Entrega de equipamentos',
    'Cadastro no Vale Transporte',
    'Cadastro no Vale Refeição / iFood',
    'Apresentação ao time',
    'Treinamento de integração',
  ],
  FREELANCER: [
    'Contrato de prestação de serviços assinado',
    'Dados bancários cadastrados (PJ ou PF)',
    'Briefing do projeto / escopo definido',
    'Acesso pontual às ferramentas necessárias',
    'Apresentação ao time responsável',
  ],
}

export function regimeToOnboardingTipo(regime: Regime): OnboardingTipo {
  return regime
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
  candidatoEmail?: string
  candidatoTelefone?: string
  vagaId: string
  vagaCargo: string
  empresa: string
  // Tipo do contrato — determina o checklist usado.
  tipo?: OnboardingTipo
  // Regime da vaga (CLT / PJ / ESTAGIO / FREELANCER) — mantido por compat.
  regime?: Regime
  dataAdmissao?: Timestamp
  // Data prevista de início (informada pelo RH ao aprovar o candidato).
  dataPrevistaInicio?: Timestamp
  // Data prevista de término (estagiários geralmente; opcional p/ outros).
  dataPrevistaTermino?: Timestamp
  // Indicação (carrega quando origem === 'indicacao'): para countdown de
  // bônus de 90 dias contado a partir do início.
  indicadoPorNome?: string
  indicadoPorUid?: string
  status: 'pendente' | 'em_andamento' | 'concluido'
  checklist: OnboardingItem[]
  createdAt: Timestamp
  updatedAt: Timestamp
  // Setado quando o onboarding é concluído e o estagiário/colaborador
  // correspondente é criado em 'estagiarios' ou 'colaboradores'.
  estagiarioId?: string
  colaboradorId?: string
}

// ═════════════════════════ NOTIFICAÇÕES ═════════════════════════
// Notificações internas (sino) — ex.: aviso ao gestor de que sua nova
// contratação entrou em onboarding ou que está perto do fim do contrato.
export type NotificacaoTipo =
  | 'onboarding_criado'
  | 'onboarding_concluido'
  | 'contrato_terminando'
  | 'periodo_experiencia'
  | 'outro'

export interface Notificacao {
  id: string
  // uid do destinatário (gestor / RH).
  destinatarioUid: string
  destinatarioEmail?: string
  tipo: NotificacaoTipo
  titulo: string
  mensagem: string
  link?: string // rota interna pra abrir o item relacionado
  lida: boolean
  createdAt: Timestamp
  // Origem (vaga, candidato, onboarding, estagio etc) — útil pra deduplicar.
  refColecao?: string
  refId?: string
}

// ═════════════════════════ DP — ESTAGIÁRIOS ═════════════════════════
export interface Estagiario {
  id: string
  nome: string
  email?: string
  telefone?: string
  cpf?: string
  curso: string
  instituicao: string
  semestre?: string
  empresa: string
  area: string
  mentor?: string
  gestorUid?: string
  gestorNome?: string
  dataInicio: Timestamp
  dataTermino: Timestamp
  bolsa?: number
  status: 'ativo' | 'finalizado' | 'desligado' | 'efetivado'
  observacoes?: string
  // Origem (quando criado a partir do fluxo de onboarding).
  candidatoId?: string
  vagaId?: string
  onboardingId?: string
  // Quando o estágio é efetivado (vira PJ/CLT), guarda o id do colaborador
  // gerado para vínculo cruzado e auditoria.
  colaboradorId?: string
  // Indicação (carrega quando origem === 'indicacao'): mantida no estagiário
  // para que, ao efetivar, o colaborador herde os dados de bônus de 90 dias.
  indicadoPorNome?: string
  indicadoPorUid?: string
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
  telefone?: string
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
  // Indicação (carrega quando contratado por indicação):
  // usado pelo card de countdown de bônus de 90 dias no DP.
  indicadoPorNome?: string
  indicadoPorUid?: string
  // Origem (quando criado a partir do fluxo de onboarding).
  candidatoId?: string
  vagaId?: string
  onboardingId?: string
  estagiarioId?: string // se foi efetivado de estágio
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

// ═════════════════════════ SORTEIOS ═════════════════════════
// Feature stand-alone: RH cria sorteio, página pública recebe inscrições
// com login Google (bloqueio por domínio corporativo). O sistema sorteia
// 1 vencedor aleatório dentro da janela configurada pelo RH.
export type SorteioStatus = 'rascunho' | 'inscricoes_abertas' | 'aguardando_sorteio' | 'sorteado' | 'cancelado'

export const SORTEIO_STATUS_LABEL: Record<SorteioStatus, string> = {
  rascunho: 'Rascunho',
  inscricoes_abertas: 'Inscrições abertas',
  aguardando_sorteio: 'Aguardando sorteio',
  sorteado: 'Sorteado',
  cancelado: 'Cancelado',
}

export interface Sorteio {
  id: string
  titulo: string
  descricao?: string
  premio: string

  // Informativo só pra exibição — "data do evento do prêmio".
  dataEvento?: Timestamp

  // Janela em que o botão "Sortear" fica habilitado pro RH. Inscrições
  // são automaticamente fechadas quando `janelaSorteioInicio` passa.
  janelaSorteioInicio: Timestamp
  janelaSorteioFim: Timestamp

  status: SorteioStatus

  // Metadados de criação.
  criadoPorUid: string
  criadoPorNome: string
  criadoEm: Timestamp

  // Vencedor (preenchido quando sorteado).
  vencedorUid?: string
  vencedorNome?: string
  vencedorEmail?: string
  sorteadoEm?: Timestamp
  sorteadoPorUid?: string
  sorteadoPorNome?: string

  // Contador denormalizado pra exibir na lista sem precisar ler a
  // subcoleção inteira. Atualizado a cada inscrição.
  totalInscritos?: number
}

export interface SorteioParticipante {
  uid: string
  nome: string
  email: string
  inscritoEm: Timestamp
}
