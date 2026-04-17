import type { Vaga } from '../../types'
import { STATUS_LABELS } from '../../types'

const NIVEL_LABEL: Record<string, string> = {
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
const JORNADA_LABEL: Record<string, string> = {
  hibrido: 'Híbrido (3 presencial + 2 remoto)',
  presencial: 'Presencial',
  remoto: 'Remoto',
  outro: 'Outro',
}
const EXP_LABEL: Record<string, string> = {
  sem_minimo: 'Sem tempo mínimo',
  '1_3': '1 a 3 anos',
  '3_5': '3 a 5 anos',
  '5_8': '5 a 8 anos',
  mais_8: 'Mais de 8 anos',
}
const FORMACAO_LABEL: Record<string, string> = {
  ensino_medio: 'Ensino Médio Completo',
  superior_incompleto: 'Superior Incompleto',
  superior_completo: 'Superior Completo',
  pos: 'Pós-Graduação',
  mestrado_doutorado: 'Mestrado/Doutorado',
}

function Info({ label, value }: { label: string; value?: string | boolean | null }) {
  const display =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'boolean'
        ? value
          ? 'Sim'
          : 'Não'
        : value
  return (
    <div>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 14 }}>{display}</div>
    </div>
  )
}

function Multiline({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
        {value && value.trim() !== '' ? value : '—'}
      </div>
    </div>
  )
}

export default function VagaDetalheView({ vaga }: { vaga: Vaga }) {
  return (
    <div className="row-gap-16">
      <div className="card">
        <h3>Identificação</h3>
        <div className="form-grid">
          <Info label="Empresa" value={vaga.empresa} />
          <Info label="Cargo" value={vaga.cargo} />
          <Info label="Time / Área" value={vaga.time} />
          <Info label="Gestor responsável" value={`${vaga.gestorNome} · ${vaga.gestorEmail}`} />
        </div>
      </div>

      <div className="card">
        <h3>Motivo da abertura</h3>
        <div className="form-grid">
          <Info label="Motivo" value={vaga.motivo === 'aumento' ? 'Aumento de quadro' : 'Substituição'} />
          {vaga.motivo === 'substituicao' && (
            <Info label="Pessoa substituída" value={vaga.substituidoNome} />
          )}
        </div>
        {vaga.motivo === 'aumento' && (
          <div style={{ marginTop: 14 }}>
            <Multiline label="Justificativa do aumento" value={vaga.justificativaAumento} />
          </div>
        )}
      </div>

      <div className="card">
        <h3>Condições</h3>
        <div className="form-grid">
          <Info label="Regime" value={vaga.regime} />
          <Info
            label="Nível"
            value={vaga.nivel === 'outro' ? vaga.nivelOutro : NIVEL_LABEL[vaga.nivel]}
          />
          <Info
            label="Jornada"
            value={vaga.jornada === 'outro' ? vaga.jornadaOutro : JORNADA_LABEL[vaga.jornada]}
          />
          <Info label="Experiência exigida" value={EXP_LABEL[vaga.tempoExperiencia]} />
          <Info label="Formação exigida" value={FORMACAO_LABEL[vaga.formacao]} />
          <Info label="Prevista no orçamento?" value={vaga.previstaOrcamento} />
        </div>
        {vaga.cursosValidos && (
          <div style={{ marginTop: 14 }}>
            <Multiline label="Cursos válidos" value={vaga.cursosValidos} />
          </div>
        )}
      </div>

      <div className="card">
        <h3>Perfil e requisitos</h3>
        <div className="row-gap-16">
          <Multiline label="Descrição das atividades" value={vaga.descricaoAtividades} />
          <Multiline label="Requisitos técnicos obrigatórios" value={vaga.requisitosTecnicos} />
          <Multiline label="Equipamentos necessários" value={vaga.equipamentos} />
          <Multiline label="Observações" value={vaga.observacoes} />
        </div>
      </div>

      <div className="card">
        <h3>Histórico de movimentações</h3>
        {(!vaga.historico || vaga.historico.length === 0) && (
          <div className="muted">Sem movimentações registradas ainda.</div>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...(vaga.historico ?? [])].reverse().map((h, idx) => (
            <li
              key={idx}
              style={{
                borderLeft: '3px solid var(--green-400)',
                paddingLeft: 14,
                paddingBottom: 4,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {h.fromStatus && h.toStatus
                  ? `${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}`
                  : h.toStatus
                    ? `Criada · ${STATUS_LABELS[h.toStatus]}`
                    : 'Atualização'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {h.byName} · {formatarTs(h.at)}
              </div>
              {h.nota && <div style={{ marginTop: 6, fontSize: 14 }}>{h.nota}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function formatarTs(ts: unknown): string {
  if (!ts) return '—'
  try {
    const d =
      typeof ts === 'object' && ts !== null && 'toDate' in ts
        ? (ts as { toDate: () => Date }).toDate()
        : new Date(ts as string | number)
    return d.toLocaleString('pt-BR')
  } catch {
    return '—'
  }
}
