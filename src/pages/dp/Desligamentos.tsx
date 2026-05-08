import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { Desligamento } from '../../types'
import { DESLIGAMENTO_TIPO_LABEL } from '../../types'

// Painel do RH para visualizar e aprovar desligamentos solicitados pelos
// gestores. Cada desligamento é um doc na coleção `desligamentos`.

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function toDateInput(ts?: Timestamp | null): string {
  if (!ts) return ''
  try {
    const d = ts.toDate()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } catch { return '' }
}

const STATUS_LABEL: Record<Desligamento['status'], string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const STATUS_BDG: Record<Desligamento['status'], string> = {
  pendente: 'warn',
  aprovado: 'info',
  concluido: 'gray',
  cancelado: 'bad',
}

export default function Desligamentos() {
  const [items, setItems] = useState<Desligamento[]>([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState<'todos' | Desligamento['status']>('todos')
  const [edit, setEdit] = useState<Desligamento | null>(null)

  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'desligamentos')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Desligamento, 'id'>) }))
      list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return u
  }, [])

  const filtered = useMemo(() => {
    return items.filter(d => statusF === 'todos' || d.status === statusF)
  }, [items, statusF])

  const kpis = useMemo(() => {
    return {
      total: items.length,
      pendentes: items.filter(d => d.status === 'pendente').length,
      aprovados: items.filter(d => d.status === 'aprovado').length,
      concluidos: items.filter(d => d.status === 'concluido').length,
    }
  }, [items])

  return (
    <>
      <Topbar title="Desligamentos" icon="⤬" />
      <div className="content">
        <div className="krow k4">
          <KpiCard label="Total" value={kpis.total} icon="⤬" tone="b" />
          <KpiCard label="Aguardando aprovação" value={kpis.pendentes} icon="⏱" tone={kpis.pendentes > 0 ? 'r' : 'g'} />
          <KpiCard label="Aprovados" value={kpis.aprovados} icon="✓" tone="a" />
          <KpiCard label="Concluídos" value={kpis.concluidos} icon="◯" tone="g" />
        </div>

        <div className="panel">
          <div className="ph">
            <div className="pt">Solicitações de desligamento</div>
            <div style={{ fontSize: 11, color: 'var(--mut)' }}>
              Gestores solicitam em "Meu time"; RH aprova e conclui aqui.
            </div>
          </div>
          <div className="filter-bar">
            <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
              <option value="todos">Todos os status</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovado">Aprovados</option>
              <option value="concluido">Concluídos</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">⤬</div>
              <div className="empty-ttl">Nenhum desligamento {statusF !== 'todos' ? 'com esse filtro' : 'registrado'}</div>
              <div className="empty-sub">Os gestores podem solicitar desligamentos pela tela "Meu time".</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Prestador</th>
                    <th>Empresa / Cargo</th>
                    <th>Tipo</th>
                    <th>Data prevista</th>
                    <th>Solicitante</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.id}>
                      <td>
                        <Link to={`/dp/colaboradores/${d.colaboradorId}`} className="tdm" style={{ textDecoration: 'none', color: 'var(--fg)' }}>
                          {d.colaboradorNome}
                        </Link>
                        {d.observacoesRh && <div className="tds" title={d.observacoesRh}>{d.observacoesRh.slice(0, 60)}{d.observacoesRh.length > 60 ? '…' : ''}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{d.empresa} · {d.cargo}</td>
                      <td style={{ fontSize: 12 }}>{DESLIGAMENTO_TIPO_LABEL[d.tipo]}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDate(d.dataPrevista)}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{d.solicitanteNome}</td>
                      <td>
                        <span className={`bdg ${STATUS_BDG[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                        {d.status === 'concluido' && d.dataEfetiva && (
                          <div style={{ fontSize: 10, color: 'var(--mut)', marginTop: 2 }}>{fmtDate(d.dataEfetiva)}</div>
                        )}
                      </td>
                      <td>
                        <button type="button" className="tbtn" onClick={() => setEdit(d)} style={{ height: 26 }}>
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

      {edit && <DesligamentoModal d={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function DesligamentoModal({ d, onClose }: { d: Desligamento; onClose: () => void }) {
  const { profile } = useAuth()
  const [observacoesRh, setObservacoesRh] = useState(d.observacoesRh ?? '')
  const [dataEfetiva, setDataEfetiva] = useState(toDateInput(d.dataEfetiva))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function aprovar() {
    if (!profile) return
    setSaving(true); setErr(null)
    try {
      await updateDoc(doc(db, 'desligamentos', d.id), {
        status: 'aprovado',
        aprovadoPorUid: profile.uid,
        aprovadoPorNome: profile.name,
        aprovadoEm: serverTimestamp(),
        observacoesRh: observacoesRh || null,
        atualizadoEm: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao aprovar.')
    } finally { setSaving(false) }
  }

  async function concluir(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (!dataEfetiva) { setErr('Informe a data efetiva de desligamento.'); return }
    setSaving(true); setErr(null)
    try {
      const dataTs = Timestamp.fromDate(new Date(dataEfetiva + 'T00:00:00'))
      await updateDoc(doc(db, 'desligamentos', d.id), {
        status: 'concluido',
        dataEfetiva: dataTs,
        observacoesRh: observacoesRh || null,
        atualizadoEm: serverTimestamp(),
      })
      // Atualiza o prestador: status=desligado, dataDemissao
      await updateDoc(doc(db, 'colaboradores', d.colaboradorId), {
        status: 'desligado',
        dataDemissao: dataTs,
        desligamentoSolicitadoId: null,
        updatedAt: serverTimestamp(),
      })
      // Notifica o gestor solicitante
      await addDoc(collection(db, 'notificacoes'), {
        destinatarioUid: d.solicitanteUid,
        tipo: 'onboarding_concluido',
        titulo: `Desligamento concluído: ${d.colaboradorNome}`,
        mensagem: `O desligamento de ${d.colaboradorNome} foi concluído pelo RH em ${fmtDate(dataTs)}.`,
        link: `/gestor/equipe`,
        lida: false,
        createdAt: serverTimestamp(),
        refColecao: 'desligamentos',
        refId: d.id,
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao concluir.')
    } finally { setSaving(false) }
  }

  async function cancelar() {
    if (!confirm('Cancelar essa solicitação de desligamento?')) return
    setSaving(true); setErr(null)
    try {
      await updateDoc(doc(db, 'desligamentos', d.id), {
        status: 'cancelado',
        observacoesRh: observacoesRh || null,
        atualizadoEm: serverTimestamp(),
      })
      await updateDoc(doc(db, 'colaboradores', d.colaboradorId), {
        desligamentoSolicitadoId: null,
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao cancelar.')
    } finally { setSaving(false) }
  }

  const podeAprovar = d.status === 'pendente'
  const podeConcluir = d.status === 'aprovado'
  const podeCancelar = d.status === 'pendente' || d.status === 'aprovado'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Desligamento — {d.colaboradorNome}</h2>
        <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>
          {d.empresa} · {d.cargo}
        </div>
        {err && <div className="error-text">{err}</div>}
        <div style={{ background: 'var(--card2)', padding: 12, borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
          <div><b>Tipo:</b> {DESLIGAMENTO_TIPO_LABEL[d.tipo]}</div>
          <div><b>Data prevista:</b> {fmtDate(d.dataPrevista)}</div>
          <div><b>Solicitante:</b> {d.solicitanteNome}</div>
          <div style={{ marginTop: 6 }}><b>Motivo:</b><br />{d.motivo}</div>
        </div>

        <form onSubmit={concluir} className="row-gap-14">
          <div className="field">
            <label>Observações do RH</label>
            <textarea
              rows={3}
              value={observacoesRh}
              onChange={(e) => setObservacoesRh(e.target.value)}
              placeholder="Ex.: rescisão calculada, devolução de equipamentos confirmada…"
            />
          </div>

          {podeConcluir && (
            <div className="field">
              <label>Data efetiva de desligamento *</label>
              <input type="date" value={dataEfetiva} onChange={(e) => setDataEfetiva(e.target.value)} required />
              <small style={{ fontSize: 11, color: 'var(--mut)' }}>
                Marca o prestador como "desligado" e registra essa data como data de demissão.
              </small>
            </div>
          )}

          <div className="hstack" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
            <div className="hstack" style={{ gap: 8 }}>
              {podeCancelar && (
                <button type="button" className="btn" onClick={cancelar} disabled={saving} style={{ color: 'var(--bad)' }}>
                  Cancelar solicitação
                </button>
              )}
              {podeAprovar && (
                <button type="button" className="btn" onClick={aprovar} disabled={saving}>
                  {saving ? 'Aprovando…' : 'Aprovar'}
                </button>
              )}
              {podeConcluir && (
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Concluindo…' : 'Concluir desligamento'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
