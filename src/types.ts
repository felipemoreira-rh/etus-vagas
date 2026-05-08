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

// Renomeado em 2026-05: "Contratada" → "Finalizada". O valor interno
// continua sendo `contratada` para compat com docs antigos do Firestore.
export const STATUS_LABELS: Record<VagaStatus, string> = {
  aberta: 'Aberta',
  triagem: 'Triagem de CVs',
  entrevistas: 'Em entrevistas',
  proposta: 'Proposta',
  contratada: 'Finalizada',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
}

// Status que indicam que a vaga FOI fechada (parou contador de SLA).
export const STATUS_FINALIZADOS: VagaStatus[] = ['contratada', 'cancelada']

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
  // Empresas em que a vaga está aberta. Suporta multi-seleção (ex.: vaga
  // que pode ser preenchida na ETUS ou na PLUSDIN). Para vagas legadas que
  // só tinham `empresa: string`, o helper getVagaEmpresas() retorna esse
  // valor como array.
  empresas?: string[]
  /** @deprecated Use `empresas` (array). Mantido só pra compat com docs antigos. */
  empresa?: string

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

  // Quando vaga é finalizada/cancelada, gravamos o timestamp do fechamento
  // e quantos dias ela ficou aberta. Permite calcular SLA médio das
  // finalizadas e mostrar "Aberta em" + "Fechada em" no detalhe.
  dataFechamento?: Timestamp
  diasAberta?: number
}

// Helper pra ler empresas de uma vaga lidando com docs antigos que tinham
// só `empresa: string` (single value). Sempre retorna um array (vazio se nada).
export function getVagaEmpresas(v: { empresas?: string[]; empresa?: string }): string[] {
  if (Array.isArray(v.empresas) && v.empresas.length > 0) return v.empresas
  if (v.empresa && typeof v.empresa === 'string') return [v.empresa]
  return []
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
// Lista padronizada (mesma pra todos os tipos de contrato) definida pelo
// RH em maio/26. O fluxo é sempre:
//   1) enviar proposta → 2) enviar lista de documentação →
//   3) solicitar fotos e curiosidades → 4) documentos recebidos →
//   5) solicitação de contrato jurídico → 6) salvar docs no drive →
//   7) solicitação de equipamentos e acessos → 8) envio de e-mail de início →
//   9) agendamento de onboarding (com data) → 10) notificação automática
//   pro gestor que abriu a vaga → 11) cadastro de benefícios.
//
// Observações:
//   - Item 9 ("Agendamento de onboarding") aceita uma data via campo
//     `scheduledAt` no OnboardingItem; ao gravar a data, é considerado feito.
//   - Item 10 ("Notificação de início para o gestor") é marcado como
//     automático (auto=true) e concluído na criação do onboarding, já que
//     o sistema dispara a notificação pro gestor no momento da aprovação.
const CHECKLIST_PADRAO: string[] = [
  'Enviar proposta',
  'Enviar lista de documentação',
  'Solicitar fotos e curiosidades',
  'Documentos recebidos',
  'Solicitação de contrato jurídico',
  'Salvar docs no drive',
  'Solicitação de equipamentos e acessos',
  'Envio de e-mail de início',
  'Agendamento de onboarding',
  'Notificação de início para o gestor que abriu a vaga',
  'Cadastro de benefícios',
]

// Checklist específico de estágio (definido em maio/26):
// fluxo via Super Estágios + assinatura de diretoria.
const CHECKLIST_ESTAGIO: string[] = [
  'Enviar proposta',
  'Enviar link para preenchimento de forms',
  'Solicitar contrato Super Estágios',
  'Solicitar assinatura do contrato pela diretoria',
  'Solicitar fotos e curiosidades',
  'Documentos recebidos',
  'Solicitação de equipamentos e acessos',
  'Envio de e-mail de início',
  'Agendamento de onboarding',
  'Notificação de início para o gestor que abriu a vaga',
  'Cadastro de benefícios',
]

export const ONBOARDING_CHECKLIST_TEMPLATES: Record<OnboardingTipo, string[]> = {
  CLT: CHECKLIST_PADRAO,
  PJ: CHECKLIST_PADRAO,
  ESTAGIO: CHECKLIST_ESTAGIO,
  FREELANCER: CHECKLIST_PADRAO,
}

// Identifica o item da lista padrão por título — útil pra lógica especial
// (item 9 com data, item 10 automático). Mantém em sincronia com CHECKLIST_PADRAO.
export const CHECKLIST_AGENDAMENTO_TITULO = 'Agendamento de onboarding'
export const CHECKLIST_NOTIFICACAO_GESTOR_TITULO = 'Notificação de início para o gestor que abriu a vaga'

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
  /** Data agendada — usado pelo item "Agendamento de onboarding". */
  scheduledAt?: Timestamp
  /** Item gerado/concluído automaticamente pelo sistema (não exige checagem manual). */
  auto?: boolean
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
// Status do estagiário. Mantemos os valores legados ('ativo' | 'finalizado'
// | 'desligado' | 'efetivado') e adicionamos 'contrato_suspenso' (paralelo
// ao Colaborador) para o fluxo de afastamento temporário.
export type EstagiarioStatusType = 'ativo' | 'finalizado' | 'desligado' | 'efetivado' | 'contrato_suspenso'

export interface Estagiario {
  id: string
  nome: string
  email?: string
  emailCorporativo?: string
  telefone?: string
  cpf?: string
  rg?: string
  curso: string
  instituicao: string
  semestre?: string
  empresa: string
  area: string
  mentor?: string
  gestorUid?: string
  gestorNome?: string
  /** Superior imediato (pode ser igual ao gestor da vaga ou outro). */
  superiorUid?: string
  superiorNome?: string
  dataInicio: Timestamp
  dataTermino: Timestamp
  bolsa?: number
  status: EstagiarioStatusType
  observacoes?: string

  // Demográficos / pessoais
  dataNascimento?: Timestamp
  genero?: Genero
  generoOutro?: string
  raca?: RacaCor
  nacionalidade?: string
  naturalidade?: string
  pcd?: boolean
  pcdDescricao?: string

  // Foto de perfil (URL pública no Storage)
  fotoUrl?: string
  fotoPath?: string

  // Endereço, contato emergência, dados bancários, família
  endereco?: Endereco
  contatoEmergencia?: ContatoEmergencia
  dadosBancarios?: DadosBancarios
  familia?: Familia

  // Educação
  escolaridade?: FormacaoEducacional[]
  idiomas?: IdiomaFalado[]

  // Documentos digitalizados (uploads)
  documentos?: DocumentoDigitalizado[]

  // Históricos imutáveis (só append)
  historicoCargo?: HistoricoCargoEntry[]
  historicoSalario?: HistoricoSalarioEntry[]

  // Histórico de suspensões temporárias de contrato
  suspensoes?: Suspensao[]
  /** Solicitação de desligamento ATIVA (referência ao doc em `desligamentos`). */
  desligamentoSolicitadoId?: string

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

export const ESTAGIARIO_STATUS_LABEL: Record<EstagiarioStatusType, string> = {
  ativo: 'Ativo',
  efetivado: 'Efetivado',
  finalizado: 'Finalizado',
  desligado: 'Desligado',
  contrato_suspenso: 'Contrato suspenso',
}

// ═════════════════════════ DP — PRESTADORES (a.k.a. Colaboradores legacy) ═════════════════════════
// Internamente a coleção continua sendo `colaboradores` (Firestore) pra
// não quebrar dados/regras antigas, mas a UI usa "Prestador" — a empresa
// contrata via PJ e quer evitar nomenclatura que sugira vínculo CLT.
export type RegimeTrabalho = 'clt' | 'pj' | 'estagio' | 'freelancer'

export const REGIME_TRABALHO_LABEL: Record<RegimeTrabalho, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  freelancer: 'Freelancer',
}

// ── Status do prestador ──────────────────────────────────────────────
// 'contrato_suspenso' foi adicionado em 2026-05; substitui semanticamente
// "férias" para PJ/freelance (mas mantemos 'ferias' aqui pra compat com
// docs legados de CLT/estágio).
export type PrestadorStatus = 'ativo' | 'ferias' | 'contrato_suspenso' | 'afastado' | 'desligado'

export const PRESTADOR_STATUS_LABEL: Record<PrestadorStatus, string> = {
  ativo: 'Ativo',
  ferias: 'Férias',
  contrato_suspenso: 'Contrato suspenso',
  afastado: 'Afastado',
  desligado: 'Desligado',
}

// ── Demográficos ─────────────────────────────────────────────────────
export type Genero =
  | 'mulher_cis'
  | 'mulher_trans'
  | 'homem_cis'
  | 'homem_trans'
  | 'nao_binario'
  | 'travesti'
  | 'outro'
  | 'prefiro_nao_dizer'

export const GENERO_LABEL: Record<Genero, string> = {
  mulher_cis: 'Mulher cis',
  mulher_trans: 'Mulher trans',
  homem_cis: 'Homem cis',
  homem_trans: 'Homem trans',
  nao_binario: 'Não-binário',
  travesti: 'Travesti',
  outro: 'Outro',
  prefiro_nao_dizer: 'Prefiro não dizer',
}

export type RacaCor = 'branca' | 'preta' | 'parda' | 'amarela' | 'indigena' | 'prefiro_nao_dizer'

export const RACA_LABEL: Record<RacaCor, string> = {
  branca: 'Branca',
  preta: 'Preta',
  parda: 'Parda',
  amarela: 'Amarela',
  indigena: 'Indígena',
  prefiro_nao_dizer: 'Prefiro não dizer',
}

export type EstadoCivil =
  | 'solteiro'
  | 'casado'
  | 'uniao_estavel'
  | 'divorciado'
  | 'viuvo'
  | 'separado'

export const ESTADO_CIVIL_LABEL: Record<EstadoCivil, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  uniao_estavel: 'União estável',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  separado: 'Separado(a)',
}

export type TipoUniao = 'comunhao_parcial' | 'comunhao_universal' | 'separacao_total' | 'final_aquestos' | 'nao_se_aplica'

export const TIPO_UNIAO_LABEL: Record<TipoUniao, string> = {
  comunhao_parcial: 'Comunhão parcial de bens',
  comunhao_universal: 'Comunhão universal de bens',
  separacao_total: 'Separação total de bens',
  final_aquestos: 'Participação final nos aquestos',
  nao_se_aplica: 'Não se aplica',
}

// ── Dados bancários e pagamento ──────────────────────────────────────
export type ContaBancariaTipo = 'corrente' | 'poupanca' | 'pagamentos' | 'salario'

export const CONTA_TIPO_LABEL: Record<ContaBancariaTipo, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Conta Poupança',
  pagamentos: 'Conta de Pagamentos',
  salario: 'Conta Salário',
}

export type ChavePixTipo = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export const PIX_TIPO_LABEL: Record<ChavePixTipo, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave aleatória',
}

export type TipoPagamento = 'transferencia' | 'pix' | 'boleto' | 'deposito'

export const TIPO_PAGAMENTO_LABEL: Record<TipoPagamento, string> = {
  transferencia: 'Transferência (TED/DOC)',
  pix: 'PIX',
  boleto: 'Boleto',
  deposito: 'Depósito',
}

export interface DadosBancarios {
  banco?: string
  agencia?: string
  conta?: string
  tipoConta?: ContaBancariaTipo
  chavePixTipo?: ChavePixTipo
  chavePixValor?: string
  /** Como a empresa paga este prestador. */
  tipoPagamento?: TipoPagamento
}

// ── Endereço ─────────────────────────────────────────────────────────
export interface Endereco {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  pais?: string
}

// ── Família ──────────────────────────────────────────────────────────
export interface Filho {
  id: string
  nome: string
  dataNascimento?: Timestamp
}

export interface Familia {
  nomePai?: string
  nomeMae?: string
  estadoCivil?: EstadoCivil
  tipoUniao?: TipoUniao
  nomeConjuge?: string
  possuiFilhos?: boolean
  filhos?: Filho[]
}

// ── Contato de emergência ────────────────────────────────────────────
export interface ContatoEmergencia {
  nome?: string
  parentesco?: string
  telefone?: string
}

// ── Escolaridade e idiomas ───────────────────────────────────────────
export type NivelIdioma = 'basico' | 'intermediario' | 'avancado' | 'fluente' | 'nativo'

export const NIVEL_IDIOMA_LABEL: Record<NivelIdioma, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
  fluente: 'Fluente',
  nativo: 'Nativo',
}

export interface FormacaoEducacional {
  id: string
  nivel: Formacao
  curso?: string
  instituicao?: string
  anoConclusao?: number
  emAndamento?: boolean
}

export interface IdiomaFalado {
  id: string
  idioma: string
  nivel: NivelIdioma
}

// ── Históricos imutáveis ─────────────────────────────────────────────
// Entradas só podem ser ADICIONADAS — nunca apagadas/editadas.
// Garantido por regras Firestore (verifica que o array só pode crescer
// e que entradas existentes não mudam).
export interface HistoricoCargoEntry {
  id: string
  cargoAnterior?: string
  cargoNovo: string
  motivo?: string
  vigenciaEm: Timestamp
  registradoEm: Timestamp
  registradoPorUid: string
  registradoPorNome: string
}

export interface HistoricoSalarioEntry {
  id: string
  salarioAnterior?: number
  salarioNovo: number
  motivo?: string
  vigenciaEm: Timestamp
  registradoEm: Timestamp
  registradoPorUid: string
  registradoPorNome: string
}

// ── Documentos digitalizados ─────────────────────────────────────────
export interface DocumentoDigitalizado {
  id: string
  tipo: string // ex.: 'RG', 'CPF', 'CNPJ', 'Contrato', 'Comprovante de residência'
  nome: string
  url: string
  path: string
  uploadedAt: Timestamp
  uploadedByUid: string
  uploadedByName: string
  tamanho?: number
}

// ── Solicitação de desligamento ──────────────────────────────────────
// Gestor solicita; RH aprova/encerra. Mantida em coleção própria
// `desligamentos` para histórico/auditoria.
export interface Desligamento {
  id: string
  colaboradorId: string
  colaboradorNome: string
  empresa: string
  cargo: string

  /**
   * Tipo do contratado que está sendo desligado. Se ausente, assume
   * 'colaborador' (default histórico). Quando 'estagiario', o desligamento
   * pertence a um doc da coleção `estagiarios` em vez de `colaboradores`.
   */
  contratadoTipo?: 'colaborador' | 'estagiario'

  /** Motivo informado pelo gestor (texto livre). */
  motivo: string
  /** Tipo de desligamento. */
  tipo: 'voluntario' | 'sem_justa_causa' | 'com_justa_causa' | 'fim_contrato' | 'outro'

  /** Data prevista para o desligamento (informada pelo gestor). */
  dataPrevista: Timestamp

  /** Solicitante (gestor) e responsável (RH que aprova). */
  solicitanteUid: string
  solicitanteNome: string

  status: 'pendente' | 'aprovado' | 'concluido' | 'cancelado'
  aprovadoPorUid?: string
  aprovadoPorNome?: string
  aprovadoEm?: Timestamp

  /** Data efetiva quando o RH conclui. */
  dataEfetiva?: Timestamp
  observacoesRh?: string

  criadoEm: Timestamp
  atualizadoEm: Timestamp
}

export const DESLIGAMENTO_TIPO_LABEL: Record<Desligamento['tipo'], string> = {
  voluntario: 'Voluntário (pedido do prestador)',
  sem_justa_causa: 'Sem justa causa',
  com_justa_causa: 'Com justa causa',
  fim_contrato: 'Fim de contrato',
  outro: 'Outro',
}

export interface Colaborador {
  id: string
  nome: string
  email?: string
  emailCorporativo?: string
  telefone?: string
  cpf?: string
  rg?: string
  /** PJ ou freelance — nome da empresa do prestador (CNPJ). */
  nomeEmpresaPrestador?: string
  /** PJ ou freelance — CNPJ do prestador. */
  cnpj?: string
  cargo: string
  area: string
  empresa: string
  regime: RegimeTrabalho
  dataAdmissao: Timestamp
  dataDemissao?: Timestamp
  salario?: number
  gestorUid?: string
  gestorNome?: string
  /** Superior imediato (pode ser igual ao gestor da vaga ou outro). */
  superiorUid?: string
  superiorNome?: string
  status: PrestadorStatus

  // Demográficos / pessoais
  dataNascimento?: Timestamp
  genero?: Genero
  generoOutro?: string
  raca?: RacaCor
  nacionalidade?: string
  naturalidade?: string // cidade-UF
  pcd?: boolean
  pcdDescricao?: string

  // Foto de perfil (URL pública no Storage)
  fotoUrl?: string
  fotoPath?: string

  // Endereço, contato emergência, dados bancários, família
  endereco?: Endereco
  contatoEmergencia?: ContatoEmergencia
  dadosBancarios?: DadosBancarios
  familia?: Familia

  // Educação
  escolaridade?: FormacaoEducacional[]
  idiomas?: IdiomaFalado[]

  // Documentos digitalizados (uploads)
  documentos?: DocumentoDigitalizado[]

  // Históricos imutáveis (só append)
  historicoCargo?: HistoricoCargoEntry[]
  historicoSalario?: HistoricoSalarioEntry[]

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
  // Histórico de suspensões temporárias de contrato (afastamento por
  // doença, maternidade, licença não-remunerada etc.). O gestor solicita
  // direto pelo app e o RH vê no histórico — sem aprovação formal.
  suspensoes?: Suspensao[]
  /** Solicitação de desligamento ATIVA (referência ao doc em `desligamentos`). */
  desligamentoSolicitadoId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Suspensao {
  id: string
  /** Tipo de afastamento — só pra agrupar/filtrar no histórico do RH. */
  tipo: 'doenca' | 'maternidade' | 'paternidade' | 'licenca' | 'acidente' | 'outro'
  motivo: string
  inicio: Timestamp
  /** Quando termina; se vazio, suspensão ainda está em aberto. */
  fim?: Timestamp
  /** 'ativa' enquanto sem `fim`; 'encerrada' quando o gestor fecha. */
  status: 'ativa' | 'encerrada'
  solicitanteUid: string
  solicitanteNome: string
  criadoEm: Timestamp
  encerradoEm?: Timestamp
}

export const SUSPENSAO_TIPO_LABEL: Record<Suspensao['tipo'], string> = {
  doenca: 'Doença / atestado médico',
  maternidade: 'Licença maternidade',
  paternidade: 'Licença paternidade',
  licenca: 'Licença não-remunerada',
  acidente: 'Acidente de trabalho',
  outro: 'Outro',
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
