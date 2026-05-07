/**
 * Helpers para integração com Google Agenda.
 *
 * Abordagem: gera uma URL do Google Calendar "event edit" que abre uma nova
 * aba com o evento pré-preenchido. O usuário só confirma em "Salvar".
 *
 * Não requer OAuth/API key — funciona em qualquer dispositivo só com o link.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Formata uma data pro padrão exigido pelo Google Calendar: 20260101T140000 */
export function formatForCalendar(date: Date): string {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

export interface CalendarEventInput {
  titulo: string
  inicio: Date
  fim: Date
  detalhes?: string
  local?: string
  participantesEmails?: string[]
}

/**
 * Gera a URL do Google Calendar pra criar um evento com os campos já
 * preenchidos. Abrir em uma nova aba.
 */
export function googleCalendarEventUrl(input: CalendarEventInput): string {
  const params = new URLSearchParams()
  params.set('action', 'TEMPLATE')
  params.set('text', input.titulo)
  params.set('dates', `${formatForCalendar(input.inicio)}/${formatForCalendar(input.fim)}`)
  if (input.detalhes) params.set('details', input.detalhes)
  if (input.local) params.set('location', input.local)
  if (input.participantesEmails && input.participantesEmails.length > 0) {
    params.set('add', input.participantesEmails.join(','))
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Combina data + hora (ambos em ISO local) numa Date. */
export function combineDateTime(dateIso: string, timeIso: string): Date {
  return new Date(`${dateIso}T${timeIso}`)
}
