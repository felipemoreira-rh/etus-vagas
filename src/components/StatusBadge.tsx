import type { VagaStatus } from '../types'
import { STATUS_LABELS } from '../types'

export default function StatusBadge({ status }: { status: VagaStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}
