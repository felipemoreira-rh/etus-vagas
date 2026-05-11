import { useState, type FormEvent } from 'react'
import { arrayUnion, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { combineDateTime, googleCalendarEventUrl } from '../utils/calendar'
import type { AgendamentoEntrevista, Candidato } from '../types'

interface Props {
  candidato: Candidato
  readonly?: boolean
}

/** Botão que abre um modal pra agendar entrevista e cria evento no Google Agenda. */
export default function ScheduleInterviewButton({ candidato, readonly }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={readonly ? 'btn btn-secondary' : 'btn btn-primary'}
        onClick={() => setOpen(true)}
      >
        📅 Agendar entrevista
      </button>
      {open && (
        <AgendarModal
          candidato={candidato}
          readonly={readonly}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function AgendarModal({
  candidato,
  readonly,
  onClose,
}: {
  candidato: Candidato
  readonly?: boolean
  onClose: () => void
}) {
  const { profile } = useAuth()
  const todayIso = new Date().toISOString().slice(0, 10)
  const [titulo, setTitulo] = useState(`Entrevista — ${candidato.nome} (${candidato.vagaCargo})`)
  const [data, setData] = useState(todayIso)
  const [horaIni, setHoraIni] = useState('10:00')
  const [horaFim, setHoraFim] = useState('11:00')
  const [participantes, setParticipantes] = useState(candidato.email || '')
  const [local, setLocal] = useState('Google Meet / a definir')
  const [observacoes, setObservacoes] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setErr(null)
    setSaving(true)
    try {
      const inicio = combineDateTime(data, horaIni)
      const fim = combineDateTime(data, horaFim)
      if (fim <= inicio) throw new Error('Horário final deve ser depois do inicial.')

      const emails = participantes
        .split(/[;,\s]+/)
        .map(s => s.trim())
        .filter(Boolean)

      const detalhes = [
        `Candidato: ${candidato.nome}`,
        candidato.email ? `E-mail: ${candidato.email}` : null,
        candidato.telefone ? `Telefone: ${candidato.telefone}` : null,
        `Vaga: ${candidato.vagaCargo}`,
        observacoes ? `\nObservações: ${observacoes}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      const calendarUrl = googleCalendarEventUrl({
        titulo,
        inicio,
        fim,
        detalhes,
        local,
        participantesEmails: emails,
      })

      // Abre a agenda
      window.open(calendarUrl, '_blank', 'noopener')

      // Salva no Firestore (só quando RH, pois Gestor não tem write)
      if (!readonly) {
        const agendamento: AgendamentoEntrevista = {
          id: `${Date.now()}`,
          titulo,
          inicio: Timestamp.fromDate(inicio),
          fim: Timestamp.fromDate(fim),
          participantes: emails,
          local,
          observacoes,
          calendarUrl,
          criadoPorUid: profile.uid,
          criadoPorNome: profile.name,
          criadoEm: Timestamp.now(),
        }
        await updateDoc(doc(db, 'candidatos', candidato.id), {
          agendamentos: arrayUnion(agendamento),
          updatedAt: serverTimestamp(),
        })
      }
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao agendar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Agendar entrevista</h2>
        <p>Ao confirmar, abrimos o Google Agenda com o evento pré-preenchido em uma nova aba.</p>
        <form onSubmit={submit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="field">
            <label>Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="field">
              <label>Local</label>
              <input value={local} onChange={(e) => setLocal(e.target.value)} />
            </div>
            <div className="field">
              <label>Início</label>
              <input type="time" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} required />
            </div>
            <div className="field">
              <label>Fim</label>
              <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label>Participantes (e-mails separados por vírgula)</label>
            <input
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              placeholder="candidato@exemplo.com, entrevistador@etus.com.br"
            />
          </div>
          <div className="field">
            <label>Observações</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Abrindo agenda…' : 'Abrir no Google Agenda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
