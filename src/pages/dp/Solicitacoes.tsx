import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  collection, doc, onSnapshot, query, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { SolicitacaoRh } from '../../types'
import { SOLICITACAO_TIPO_LABEL } from '../../types'

// Painel do RH para receber e responder solicitações abertas pelos
// estagiários / colaboradores / prestadores na rota /me.

function fmtDateTime(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try {
    return ts.toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

const STATUS_LABEL: Record<SolicitacaoRh['status'], string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
}

const STATUS_BDG: Record<SolicitacaoRh['status'], string> = {
  aberta: 'warn',
  em_andamento: 'info',
  resolvida: 'ok',
  cancelada: 'gray',
}

const TIPO_PESSOA_LABEL: Record<SolicitacaoRh['solicitanteTipo'], string> = {
  estagiario: 'Estagiário',
  colaborador: 'Colaborador (CLT)',
  prestador: 'Prestador (PJ)',
}

export default function Solicitacoes() {
  const [items, setItems] = useState<SolicitacaoRh[]>([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState<'todas' | SolicitacaoRh['status']>('todas')
  const [tipoF, setTipoF] = useState<'todos' | SolicitacaoRh['solicitanteTipo']>('todos')
  const [edit, setEdit] = useState<SolicitacaoRh | null>(null)

  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'solicitacoes_rh')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SolicitacaoRh, 'id'>) }))
      list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return u
  }, [])

  const filtered = useMemo(() => {
    return items.filter(s =>
      (statusF === 'todas' || s.status === statusF) &&
      (tipoF === 'todos' || s.solicitanteTipo === tipoF))
  }, [items, statusF, tipoF])

  const kpis = useMemo(() => ({
    total: items.length,
    abertas: items.filter(s => s.status === 'aberta').length,
    emAndamento: items.filter(s => s.status === 'em_andamento').length,
    resolvidas: items.filter(s => s.status === 'resolvida').length,
  }), [items])

  return (
    <>
      <Topbar title="Solicitações ao RH" icon="✉" />
      <div className="content">
        <div className="krow k4">
          <KpiCard label="Total" value={kpis.total} icon="✉" tone="b" />
          <KpiCard
            label="Aguardando"
            value={kpis.abertas}
            icon="⏱"
            tone={kpis.abertas > 0 ? 'r' : 'g'}
          />
          <KpiCard label="Em andamento" value={kpis.emAndamento} icon="↻" tone="a" />
          <KpiCard label="Resolvidas" value={kpis.resolvidas} icon="✓" tone="g" />
        </div>

        <div className="panel">
          <div className="ph">
            <div className="pt">Solicitações recebidas</div>
            <div style={{ fontSize: 11, color: 'var(--mut)' }}>
              Cada estagiário / colaborador / prestador abre solicitações pelo
              próprio perfil (rota /me). Aqui o RH responde.
            </div>
          </div>
          <div className="filter-bar">
            <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
              <option value="todas">Todos os status</option>
              <option value="aberta">Abertas</option>
              <option value="em_andamento">Em andamento</option>
              <option value="resolvida">Resolvidas</option>
              <option value="cancelada">Canceladas</option>
            </select>
            <select value={tipoF} onChange={(e) => setTipoF(e.target.value as typeof tipoF)}>
              <option value="todos">Todos os tipos de pessoa</option>
              <option value="estagiario">Estagiários</option>
              <option value="colaborador">Colaboradores (CLT)</option>
              <option value="prestador">Prestadores (PJ)</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">✉</div>
              <div className="empty-ttl">Nenhuma solicitação</div>
              <div className="empty-sub">As solicitações aparecem aqui quando alguém abre pelo /me.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Assunto</th>
                    <th>Tipo</th>
                    <th>Solicitante</th>
                    <th>Aberta em</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div className="tdm">{s.titulo}</div>
                        <div className="tds" style={{ fontSize: 11, color: 'var(--mut)' }}>
                          {s.mensagem.slice(0, 80)}{s.mensagem.length > 80 ? '…' : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {SOLICITACAO_TIPO_LABEL[s.tipo]}
                      </td>
                      <td>
                        <div className="tdm">{s.solicitanteNome}</div>
                        <div className="tds" style={{ fontSize: 11, color: 'var(--mut)' }}>
                          {TIPO_PESSOA_LABEL[s.solicitanteTipo]} · {s.solicitanteEmail}
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDateTime(s.criadoEm)}</td>
                      <td>
                        <span className={`bdg ${STATUS_BDG[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                      </td>
                      <td>
                        <button type="button" className="tbtn" onClick={() => setEdit(s)} style={{ height: 26 }}>
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {edit && <SolicitacaoModal s={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function SolicitacaoModal({ s, onClose }: { s: SolicitacaoRh; onClose: () => void }) {
  const { profile } = useAuth()
  const [resposta, setResposta] = useState(s.respostaRh ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function marcarEmAndamento() {
    if (!profile) return
    setSaving(true); setErr(null)
    try {
      await updateDoc(doc(db, 'solicitacoes_rh', s.id), {
        status: 'em_andamento',
        respostaRh: resposta || null,
        respondidoPorUid: profile.uid,
        respondidoPorNome: profile.name,
        atualizadoEm: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  async function resolver(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (resposta.trim().length < 3) { setErr('Escreva uma resposta antes de resolver.'); return }
    setSaving(true); setErr(null)
    try {
      await updateDoc(doc(db, 'solicitacoes_rh', s.id), {
        status: 'resolvida',
        respostaRh: resposta.trim(),
        respondidoPorUid: profile.uid,
        respondidoPorNome: profile.name,
        respondidoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao resolver.')
    } finally { setSaving(false) }
  }

  async function cancelar() {
    if (!confirm('Cancelar essa solicitação?')) return
    if (!profile) return
    setSaving(true); setErr(null)
    try {
      await updateDoc(doc(db, 'solicitacoes_rh', s.id), {
        status: 'cancelada',
        respostaRh: resposta || null,
        respondidoPorUid: profile.uid,
        respondidoPorNome: profile.name,
        atualizadoEm: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao cancelar.')
    } finally { setSaving(false) }
  }

  const podeIniciar = s.status === 'aberta'
  const podeResolver = s.status === 'aberta' || s.status === 'em_andamento'
  const podeCancelar = s.status !== 'cancelada' && s.status !== 'resolvida'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{s.titulo}</h2>
        <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>
          {SOLICITACAO_TIPO_LABEL[s.tipo]} · {TIPO_PESSOA_LABEL[s.solicitanteTipo]} ·{' '}
          {s.solicitanteNome} ({s.solicitanteEmail})
        </div>
        {err && <div className="error-text">{err}</div>}
        <div style={{ background: 'var(--card2)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
          {s.mensagem}
        </div>

        <form onSubmit={resolver} className="row-gap-14">
          <div className="field">
            <label>Resposta do RH</label>
            <textarea
              rows={4}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Escreva uma resposta antes de resolver."
            />
          </div>
          <div className="hstack" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Fechar
            </button>
            <div className="hstack" style={{ gap: 8 }}>
              {podeCancelar && (
                <button type="button" className="btn" onClick={cancelar} disabled={saving} style={{ color: 'var(--bad)' }}>
                  Cancelar
                </button>
              )}
              {podeIniciar && (
                <button type="button" className="btn" onClick={marcarEmAndamento} disabled={saving}>
                  Em andamento
                </button>
              )}
              {podeResolver && (
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando…' : 'Resolver'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
