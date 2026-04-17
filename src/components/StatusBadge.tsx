import { STATUS_LABELS, type VagaStatus } from '../types'

export default function StatusBadge({ status }: { status: VagaStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}
