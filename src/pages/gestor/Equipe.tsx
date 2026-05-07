import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Colaborador, Suspensao } from '../../types'
import { REGIME_TRABALHO_LABEL, SUSPENSAO_TIPO_LABEL } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function suspensaoAtiva(c: Colaborador): Suspensao | null {
  const list = c.suspensoes || []
  return list.find(s => s.status === 'ativa') || null
}

export default function GestorEquipe() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openSuspensao, setOpenSuspensao] = useState<Colaborador | null>(null)
  const [encerrando, setEncerrando] = useState<{ colab: Colaborador; suspensao: Suspensao } | null>(null)

  useEffect(() => {
    if (!profile?.uid) return
    // Lista só os colaboradores do próprio gestor (rule do Firestore já filtra,
    // mas usar where aqui economiza tráfego e garante ordenação).
    const q = query(
      collection(db, 'colaboradores'),
      where('gestorUid', '==', profile.uid),
    )
    const unsub = onSnapshot(q, (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) }))
      list.sort((a, b) => a.nome.localeCompare(b.nome))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [profile?.uid])

  const filtered = useMemo(() => {
    if (!search) return items
    const s = search.toLowerCase()
    return items.filter(c =>
      c.nome.toLowerCase().includes(s) ||
      c.cargo.toLowerCase().includes(s) ||
      c.area.toLowerCase().includes(s),
    )
  }, [items, search])

  return (
    <>
      <Topbar title="Meu time" icon="◉" />
      <div className="content">
        <div className="panel">
          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input
                className="srch"
                placeholder="Buscar por nome, cargo ou área…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◉</div>
              <div className="empty-ttl">Nenhum colaborador no seu time</div>
              <div className="empty-sub">
                Quando o RH efetivar uma contratação que ficar sob sua gestão, ela aparece aqui.
              </div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th>Área</th>
                    <th>Regime</th>
                    <th>Admissão</th>
                    <th>Status</th>
                    <th style={{ width: 200 }}>Suspensão de contrato</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const ativa = suspensaoAtiva(c)
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="tdm">{c.nome}</div>
                          <div className="tds">{c.email || '—'}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{c.cargo}</td>
                        <td style={{ fontSize: 12, color: 'var(--mut)' }}>{c.area}</td>
                        <td style={{ fontSize: 12 }}>{REGIME_TRABALHO_LABEL[c.regime]}</td>
                        <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(c.dataAdmissao)}</td>
                        <td>
                          <span className={`bdg ${
                            c.status === 'ativo' ? 'ok' :
                            c.status === 'ferias' ? 'warn' :
                            c.status === 'afastado' ? 'info' : 'bad'
                          }`}>
                            {c.status === 'ativo' ? 'Ativo' :
                             c.status === 'ferias' ? 'Férias' :
                             c.status === 'afastado' ? 'Afastado' : 'Desligado'}
                          </span>
                        </td>
                        <td>
                          {ativa ? (
                            <div className="vstack" style={{ gap: 4 }}>
                              <div style={{ fontSize: 11, color: 'var(--info, #2563eb)', fontWeight: 600 }}>
                                Suspenso desde {formatDate(ativa.inicio)}
                              </div>
                              <button
                                type="button"
                                className="tbtn"
                                style={{ height: 26 }}
                                onClick={() => setEncerrando({ colab: c, suspensao: ativa })}
                              >
                                Encerrar suspensão
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="tbtn"
                              style={{ height: 26 }}
                              onClick={() => setOpenSuspensao(c)}
                              disabled={c.status === 'desligado'}
                            >
                              Solicitar suspensão
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Histórico curto: lista as últimas suspensões (ativas + encerradas)
            do time todo, pra dar visibilidade ao próprio gestor. O RH tem
            uma visão completa em DP → Colaboradores. */}
        <HistoricoCurto items={items} />
      </div>

      {openSuspensao && profile && (
        <SolicitarSuspensaoModal
          colaborador={openSuspensao}
          profileUid={profile.uid}
          profileName={profile.name || profile.email || ''}
          onClose={() => setOpenSuspensao(null)}
        />
      )}
      {encerrando && (
        <EncerrarSuspensaoModal
          colaborador={encerrando.colab}
          suspensao={encerrando.suspensao}
          onClose={() => setEncerrando(null)}
        />
      )}
    </>
  )
}

function HistoricoCurto({ items }: { items: Colaborador[] }) {
  type Linha = Suspensao & { colaboradorNome: string }
  const todas = useMemo<Linha[]>(() => {
    const list: Linha[] = []
    for (const c of items) {
      for (const s of (c.suspensoes || [])) {
        list.push({ ...s, colaboradorNome: c.nome })
      }
    }
    list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
    return list.slice(0, 10)
  }, [items])

  if (todas.length === 0) return null
  return (
    <div className="panel">
      <div className="ph">
        <div className="pt">Últimas suspensões registradas</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Colaborador</th>
            <th>Tipo</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Status</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {todas.map(s => (
            <tr key={s.id}>
              <td><div className="tdm">{s.colaboradorNome}</div></td>
              <td style={{ fontSize: 12 }}>{SUSPENSAO_TIPO_LABEL[s.tipo]}</td>
              <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(s.inicio)}</td>
              <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(s.fim)}</td>
              <td>
                <span className={`bdg ${s.status === 'ativa' ? 'info' : 'gray'}`}>
                  {s.status === 'ativa' ? 'Em curso' : 'Encerrada'}
                </span>
              </td>
              <td style={{ fontSize: 12 }}>{s.motivo || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SolicitarSuspensaoModal({ colaborador, profileUid, profileName, onClose }: {
  colaborador: Colaborador
  profileUid: string
  profileName: string
  onClose: () => void
}) {
  const [tipo, setTipo] = useState<Suspensao['tipo']>('doenca')
  const [motivo, setMotivo] = useState('')
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 10))
  const [fim, setFim] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const inicioTs = Timestamp.fromDate(new Date(inicio + 'T00:00:00'))
      const fimTs = fim ? Timestamp.fromDate(new Date(fim + 'T00:00:00')) : null
      const nova: Suspensao = {
        id: `sus-${Date.now()}`,
        tipo,
        motivo: motivo.trim(),
        inicio: inicioTs,
        ...(fimTs ? { fim: fimTs } : {}),
        // Se já tem data de fim, registramos como encerrada de cara.
        status: fimTs ? 'encerrada' : 'ativa',
        solicitanteUid: profileUid,
        solicitanteNome: profileName,
        criadoEm: Timestamp.now(),
        ...(fimTs ? { encerradoEm: Timestamp.now() } : {}),
      }
      await updateDoc(doc(db, 'colaboradores', colaborador.id), {
        suspensoes: arrayUnion(nova),
        // Se estiver começando hoje ou no passado e ainda em aberto,
        // o status do colaborador vira 'afastado' pra refletir no DP.
        ...(nova.status === 'ativa' && inicioTs.toMillis() <= Date.now()
          ? { status: 'afastado' as const }
          : {}),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao registrar suspensão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Solicitar suspensão de contrato</h2>
        <p>
          Registrar afastamento temporário de <b>{colaborador.nome}</b>. O RH é
          notificado pelo histórico — não precisa de aprovação formal.
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as Suspensao['tipo'])}>
                {Object.entries(SUSPENSAO_TIPO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Início *</label>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
            </div>
            <div className="field">
              <label>Fim previsto (opcional)</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
              <small style={{ fontSize: 11, color: 'var(--mut)' }}>
                Deixe em branco se ainda não souber. Você encerra a suspensão depois.
              </small>
            </div>
            <div className="field full">
              <label>Motivo / observações *</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Atestado médico de 15 dias, retornará em 22/05."
                required
              />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Registrando…' : 'Registrar suspensão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EncerrarSuspensaoModal({ colaborador, suspensao, onClose }: {
  colaborador: Colaborador
  suspensao: Suspensao
  onClose: () => void
}) {
  const [fim, setFim] = useState(() => new Date().toISOString().slice(0, 10))
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const fimTs = Timestamp.fromDate(new Date(fim + 'T00:00:00'))
      const novaLista = (colaborador.suspensoes || []).map(s => {
        if (s.id !== suspensao.id) return s
        return {
          ...s,
          fim: fimTs,
          status: 'encerrada' as const,
          encerradoEm: Timestamp.now(),
          ...(observacoes.trim()
            ? { motivo: `${s.motivo}\n\n[Encerramento] ${observacoes.trim()}` }
            : {}),
        }
      })
      // Se essa era a única suspensão ativa, o colaborador volta a 'ativo'.
      const aindaTemAtiva = novaLista.some(s => s.status === 'ativa')
      await updateDoc(doc(db, 'colaboradores', colaborador.id), {
        suspensoes: novaLista,
        ...(aindaTemAtiva ? {} : { status: 'ativo' as const }),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao encerrar suspensão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Encerrar suspensão</h2>
        <p>
          Encerrando suspensão de <b>{colaborador.nome}</b> ({SUSPENSAO_TIPO_LABEL[suspensao.tipo]}).
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Data de retorno *</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} required />
            </div>
            <div className="field full">
              <label>Observações (opcional)</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: Retornou após alta médica."
              />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Encerrando…' : 'Encerrar suspensão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
