import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Sorteio, SorteioStatus } from '../../types'
import { SORTEIO_STATUS_LABEL } from '../../types'

export default function Sorteios() {
  const { profile } = useAuth()
  const [sorteios, setSorteios] = useState<Sorteio[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'sorteios')),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Sorteio, 'id'>) }))
        list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
        setSorteios(list)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [])

  const stats = useMemo(() => {
    const nowTs = now
    let ativos = 0
    let concluidos = 0
    for (const s of sorteios) {
      if (s.status === 'sorteado') concluidos++
      else if (s.status !== 'cancelado') {
        const fim = s.janelaSorteioFim?.toMillis?.() ?? 0
        if (fim >= nowTs) ativos++
      }
    }
    return { ativos, concluidos, total: sorteios.length }
  }, [sorteios, now])

  return (
    <>
      <Topbar
        title="Sorteios"
        icon="🎁"
        actions={
          <button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Novo sorteio</button>
        }
      />
      <div className="content">
        <div className="smrow">
          <div className="sm"><div className="sm-lbl">Ativos</div><div className="sm-val">{stats.ativos}</div></div>
          <div className="sm"><div className="sm-lbl">Sorteados</div><div className="sm-val">{stats.concluidos}</div></div>
          <div className="sm"><div className="sm-lbl">Criados</div><div className="sm-val">{stats.total}</div></div>
        </div>

        <div className="panel">
          <h3>Sorteios</h3>
          <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Cada sorteio gera uma página pública própria. Compartilhe o link com o time — só e-mails
            corporativos (@etus, @plusdin, @brius, @bhaz) conseguem se inscrever. O sistema sorteia
            um vencedor aleatório dentro da janela de tempo que você configurar.
          </p>
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : sorteios.length === 0 ? (
            <div className="empty-state">Nenhum sorteio criado ainda.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Prêmio</th>
                  <th>Janela do sorteio</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorteios.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="tdm">{s.titulo}</div>
                      {s.descricao && <div className="muted" style={{ fontSize: 11 }}>{s.descricao}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{s.premio}</td>
                    <td style={{ fontSize: 12 }}>
                      {s.janelaSorteioInicio && s.janelaSorteioFim
                        ? `${fmtDateTime(s.janelaSorteioInicio)} – ${fmtTime(s.janelaSorteioFim)}`
                        : '—'}
                    </td>
                    <td><SorteioStatusBadge status={s.status} /></td>
                    <td>
                      <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <Link to={`/rh/sorteios/${s.id}`} className="tbtn">Abrir</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {openModal && profile && (
        <NovoSorteioModal
          onClose={() => setOpenModal(false)}
          criadoPorUid={profile.uid}
          criadoPorNome={profile.name}
        />
      )}
    </>
  )
}

function SorteioStatusBadge({ status }: { status: SorteioStatus }) {
  const cls =
    status === 'sorteado' ? 'ok'
    : status === 'cancelado' ? 'bad'
    : status === 'aguardando_sorteio' ? 'warn'
    : status === 'inscricoes_abertas' ? 'info'
    : 'muted'
  return <span className={`bdg ${cls}`}>{SORTEIO_STATUS_LABEL[status]}</span>
}

function fmtTime(ts: Timestamp): string {
  try { return ts.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

function fmtDateTime(ts: Timestamp): string {
  try {
    const d = ts.toDate()
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

interface NovoSorteioModalProps {
  onClose: () => void
  criadoPorUid: string
  criadoPorNome: string
}

function NovoSorteioModal({ onClose, criadoPorUid, criadoPorNome }: NovoSorteioModalProps) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [premio, setPremio] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [inicioData, setInicioData] = useState('')
  const [inicioHora, setInicioHora] = useState('14:00')
  const [fimData, setFimData] = useState('')
  const [fimHora, setFimHora] = useState('16:00')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)

    const inicio = parseLocal(inicioData, inicioHora)
    const fim = parseLocal(fimData, fimHora)
    if (!inicio || !fim) {
      setErr('Informe data e hora de início e fim da janela do sorteio.')
      return
    }
    if (fim <= inicio) {
      setErr('O fim da janela do sorteio precisa ser depois do início.')
      return
    }
    const now = new Date()
    if (inicio < now) {
      setErr('A janela do sorteio precisa começar no futuro — senão as inscrições já estariam fechadas.')
      return
    }

    setSaving(true)
    try {
      await addDoc(collection(db, 'sorteios'), {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        premio: premio.trim(),
        dataEvento: dataEvento ? Timestamp.fromDate(parseLocalDate(dataEvento)) : null,
        janelaSorteioInicio: Timestamp.fromDate(inicio),
        janelaSorteioFim: Timestamp.fromDate(fim),
        status: 'inscricoes_abertas',
        criadoPorUid,
        criadoPorNome,
        criadoEm: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar sorteio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo sorteio</h2>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Título *</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex.: Sorteio dos ingressos do Circo" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Descrição</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Detalhes que aparecem pros participantes" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Prêmio *</label>
              <input value={premio} onChange={(e) => setPremio(e.target.value)} required placeholder="Ex.: 2 ingressos para o Circo Spacial" />
            </div>
            <div className="field">
              <label>Data do evento (opcional)</label>
              <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} />
            </div>
            <div className="field" />
            <div className="field">
              <label>Início da janela do sorteio *</label>
              <div className="hstack" style={{ gap: 6 }}>
                <input type="date" value={inicioData} onChange={(e) => setInicioData(e.target.value)} required style={{ flex: 1 }} />
                <input type="time" value={inicioHora} onChange={(e) => setInicioHora(e.target.value)} required style={{ width: 100 }} />
              </div>
            </div>
            <div className="field">
              <label>Fim da janela do sorteio *</label>
              <div className="hstack" style={{ gap: 6 }}>
                <input type="date" value={fimData} onChange={(e) => setFimData(e.target.value)} required style={{ flex: 1 }} />
                <input type="time" value={fimHora} onChange={(e) => setFimHora(e.target.value)} required style={{ width: 100 }} />
              </div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 11, margin: 0 }}>
            Inscrições ficam abertas desde a criação até o início da janela do sorteio.
            Durante a janela, o botão "Sortear" fica disponível no detalhe do sorteio.
          </p>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Criando…' : 'Criar sorteio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function parseLocal(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null
  // "YYYY-MM-DD" + "HH:mm" → Date no timezone local. Não usamos new
  // Date('YYYY-MM-DDTHH:mm') direto porque o parsing é inconsistente
  // entre browsers; montamos manualmente pra garantir timezone local.
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0) // meio-dia pra evitar salto de fuso
}
