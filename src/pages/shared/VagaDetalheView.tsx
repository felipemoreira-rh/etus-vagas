import type { Vaga } from '../../types'
import {
  EXP_LABEL,
  FORMACAO_LABEL,
  getVagaEmpresas,
  JORNADA_LABEL,
  NIVEL_LABEL,
  REGIME_LABEL,
  STATUS_LABELS,
} from '../../types'

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}

function Multiline({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--txt)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {value || <span style={{ color: 'var(--dim)' }}>—</span>}
      </div>
    </div>
  )
}

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try {
    const d = ts.toDate()
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function VagaDetalheView({ vaga }: { vaga: Vaga }) {
  const nivelLbl = vaga.nivel === 'outro' ? vaga.nivelOutro || 'Outro' : NIVEL_LABEL[vaga.nivel]
  const jornadaLbl = vaga.jornada === 'outro' ? vaga.jornadaOutro || 'Outro' : JORNADA_LABEL[vaga.jornada]

  return (
    <div className="row-gap-14">
      <div className="panel">
        <h3>Identificação</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Info label="Empresas" value={getVagaEmpresas(vaga).join(' · ') || '—'} />
          <Info label="Cargo (divulgação)" value={vaga.cargo} />
          <Info label="Time / Área" value={vaga.time} />
          <Info label="Gestor" value={vaga.gestorNome} />
          <Info label="E-mail do gestor" value={vaga.gestorEmail} />
          <Info label="Responsável RH" value={vaga.responsavelRhNome || '—'} />
        </div>
      </div>

      <div className="panel">
        <h3>Motivo</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Info label="Motivo da abertura" value={vaga.motivo === 'aumento' ? 'Aumento de quadro' : 'Substituição'} />
          {vaga.motivo === 'substituicao' ? (
            <Info label="Pessoa substituída" value={vaga.substituidoNome} />
          ) : (
            <Multiline label="Justificativa do aumento" value={vaga.justificativaAumento} />
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Condições</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Info label="Regime" value={REGIME_LABEL[vaga.regime]} />
          <Info label="Nível" value={nivelLbl} />
          <Info label="Jornada" value={jornadaLbl} />
          <Info label="Tempo de experiência" value={EXP_LABEL[vaga.tempoExperiencia]} />
          <Info label="Formação" value={FORMACAO_LABEL[vaga.formacao]} />
          <Info label="Prevista no orçamento?" value={vaga.previstaOrcamento ? 'Sim' : 'Não'} />
        </div>
      </div>

      <div className="panel">
        <h3>Perfil e requisitos</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Multiline label="Descrição das atividades" value={vaga.descricaoAtividades} />
          <Multiline label="Requisitos técnicos" value={vaga.requisitosTecnicos} />
          {vaga.cursosValidos && <Multiline label="Cursos válidos" value={vaga.cursosValidos} />}
          {vaga.equipamentos && <Multiline label="Equipamentos" value={vaga.equipamentos} />}
          {vaga.observacoes && <Multiline label="Observações" value={vaga.observacoes} />}
        </div>
      </div>

      <div className="panel">
        <h3>Histórico de movimentação</h3>
        {(!vaga.historico || vaga.historico.length === 0) ? (
          <div className="empty-sub">Sem movimentações registradas.</div>
        ) : (
          <div className="row-gap-10">
            {[...vaga.historico].reverse().map((h, i) => (
              <div
                key={i}
                style={{
                  border: '1px solid var(--b1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  background: 'var(--card2)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 4 }}>
                  {formatDate(h.at)} · {h.byName}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {h.fromStatus && h.toStatus
                    ? `${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}`
                    : h.toStatus
                      ? `Status: ${STATUS_LABELS[h.toStatus]}`
                      : 'Atualização'}
                </div>
                {h.nota && <div style={{ fontSize: 12, color: 'var(--n700)', marginTop: 6 }}>{h.nota}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
