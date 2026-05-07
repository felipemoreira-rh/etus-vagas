import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import type { Colaborador, RegimeTrabalho, Suspensao } from '../../types'
import { EMPRESA_OPTIONS, REGIME_TRABALHO_LABEL, SUSPENSAO_TIPO_LABEL } from '../../types'

type ColaboradorStatus = Colaborador['status']

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function toDateInput(ts?: { toDate: () => Date } | null): string {
  if (!ts) return ''
  try {
    const d = ts.toDate()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } catch { return '' }
}

// Dias até completar 90 desde a data de admissão. Negativo = passou.
// null = sem data.
function diasParaBonusIndicacao(adm?: Timestamp | null) {
  if (!adm) return null
  try {
    const limite = adm.toDate()
    limite.setDate(limite.getDate() + 90)
    const hoje = new Date()
    return Math.ceil((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  } catch { return null }
}

export default function Colaboradores() {
  const [items, setItems] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<string>('todos')
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Colaborador | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'colaboradores')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) }))
      list.sort((a, b) => a.nome.localeCompare(b.nome))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => {
    return items.filter(c => {
      if (statusF !== 'todos' && c.status !== statusF) return false
      if (search) {
        const s = search.toLowerCase()
        if (!c.nome.toLowerCase().includes(s) && !c.cargo.toLowerCase().includes(s) && !c.area.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [items, search, statusF])

  // Card de bônus de indicação: lista colaboradores que vieram via indicação
  // e ainda têm countdown de 90d em aberto (ou já completaram).
  const indicacoes = useMemo(() => {
    return items
      .filter(c => c.status === 'ativo' && c.indicadoPorNome)
      .map(c => ({
        c,
        diasRestantes: diasParaBonusIndicacao(c.dataAdmissao),
      }))
      .sort((a, b) => {
        const da = a.diasRestantes ?? 9999
        const db = b.diasRestantes ?? 9999
        return da - db
      })
  }, [items])

  async function excluir(c: Colaborador) {
    if (!confirm(`Excluir o colaborador "${c.nome}"?\n\nEssa ação é permanente.`)) return
    try {
      await deleteDoc(doc(db, 'colaboradores', c.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir colaborador.')
    }
  }

  return (
    <>
      <Topbar
        title="Colaboradores"
        icon="◉"
        actions={<button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Novo colaborador</button>}
      />
      <div className="content">
        {indicacoes.length > 0 && (
          <div className="panel" style={{ borderLeft: '4px solid var(--g600)' }}>
            <div className="ph">
              <div className="pt">
                <span className="pdot" style={{ background: 'var(--g600)' }} />
                Bônus de indicação · countdown 90 dias
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>
                Bônus liberado quando o indicado completa 90d desde a admissão.
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Indicado</th>
                  <th>Indicado por</th>
                  <th>Admissão</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {indicacoes.map(({ c, diasRestantes }) => {
                  const completou = diasRestantes !== null && diasRestantes <= 0
                  const cor = completou ? 'var(--ok)' : diasRestantes != null && diasRestantes <= 30 ? 'var(--warn)' : 'var(--mut)'
                  return (
                    <tr key={c.id}>
                      <td><div className="tdm">{c.nome}</div><div className="tds">{c.cargo} · {c.empresa}</div></td>
                      <td style={{ fontSize: 12 }}>{c.indicadoPorNome}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(c.dataAdmissao)}</td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: cor }}>
                        {diasRestantes === null
                          ? 'Sem data de admissão'
                          : completou
                            ? '✓ Bônus liberado'
                            : `${diasRestantes}d para liberar`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="panel">
          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input className="srch" placeholder="Buscar por nome, cargo ou área…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="ferias">Férias</option>
              <option value="afastado">Afastados</option>
              <option value="desligado">Desligados</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◉</div>
              <div className="empty-ttl">Nenhum colaborador</div>
              <div className="empty-sub">Cadastre colaboradores para acompanhar.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th>Área</th>
                    <th>Empresa</th>
                    <th>Regime</th>
                    <th>Admissão</th>
                    <th>Status</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="tdm">{c.nome}</div>
                        <div className="tds">{c.email || '—'}</div>
                        {c.indicadoPorNome && (
                          <div style={{ fontSize: 10, color: 'var(--g600)', marginTop: 2 }}>
                            Indicado por {c.indicadoPorNome}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{c.cargo}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{c.area}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{c.empresa}</td>
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
                        <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="tbtn"
                            onClick={() => setEditing(c)}
                            title="Editar"
                            style={{ height: 26 }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="tbtn"
                            onClick={() => excluir(c)}
                            title="Excluir"
                            style={{ height: 26, color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <HistoricoSuspensoes items={items} />

      {openModal && <ColaboradorModal onClose={() => setOpenModal(false)} />}
      {editing && <ColaboradorModal colaborador={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

// Histórico completo de suspensões de contrato — só aparece pro RH no DP
// (gestor vê uma versão resumida em /gestor/equipe). Inclui filtro por
// status e tipo, pra facilitar auditoria.
function HistoricoSuspensoes({ items }: { items: Colaborador[] }) {
  type Linha = Suspensao & { colaboradorId: string; colaboradorNome: string; cargo: string; empresa: string }
  const [statusF, setStatusF] = useState<'todos' | 'ativa' | 'encerrada'>('todos')
  const [tipoF, setTipoF] = useState<'todos' | Suspensao['tipo']>('todos')

  const todas = useMemo<Linha[]>(() => {
    const list: Linha[] = []
    for (const c of items) {
      for (const s of (c.suspensoes || [])) {
        list.push({ ...s, colaboradorId: c.id, colaboradorNome: c.nome, cargo: c.cargo, empresa: c.empresa })
      }
    }
    list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
    return list
  }, [items])

  const filtered = useMemo(() => {
    return todas.filter(s => {
      if (statusF !== 'todos' && s.status !== statusF) return false
      if (tipoF !== 'todos' && s.tipo !== tipoF) return false
      return true
    })
  }, [todas, statusF, tipoF])

  return (
    <div className="content" style={{ paddingTop: 0 }}>
      <div className="panel">
        <div className="ph">
          <div className="pt">Histórico de suspensões de contrato</div>
          <div style={{ fontSize: 11, color: 'var(--mut)' }}>
            Afastamentos solicitados pelos gestores. {todas.length} {todas.length === 1 ? 'registro' : 'registros'} no total.
          </div>
        </div>
        <div className="filter-bar">
          <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
            <option value="todos">Todos os status</option>
            <option value="ativa">Em curso</option>
            <option value="encerrada">Encerradas</option>
          </select>
          <select value={tipoF} onChange={(e) => setTipoF(e.target.value as typeof tipoF)}>
            <option value="todos">Todos os tipos</option>
            {Object.entries(SUSPENSAO_TIPO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-sub" style={{ padding: 14 }}>
            Nenhum registro de suspensão {todas.length === 0 ? 'ainda' : 'com esses filtros'}.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Empresa</th>
                <th>Tipo</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Status</th>
                <th>Solicitado por</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={`${s.colaboradorId}-${s.id}`}>
                  <td>
                    <div className="tdm">{s.colaboradorNome}</div>
                    <div className="tds">{s.cargo}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--mut)' }}>{s.empresa || '—'}</td>
                  <td style={{ fontSize: 12 }}>{SUSPENSAO_TIPO_LABEL[s.tipo]}</td>
                  <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(s.inicio)}</td>
                  <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(s.fim)}</td>
                  <td>
                    <span className={`bdg ${s.status === 'ativa' ? 'info' : 'gray'}`}>
                      {s.status === 'ativa' ? 'Em curso' : 'Encerrada'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--mut)' }}>{s.solicitanteNome}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{s.motivo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ColaboradorModal({ colaborador, onClose }: { colaborador?: Colaborador, onClose: () => void }) {
  const isEdit = !!colaborador
  const [nome, setNome] = useState(colaborador?.nome ?? '')
  const [email, setEmail] = useState(colaborador?.email ?? '')
  const [cargo, setCargo] = useState(colaborador?.cargo ?? '')
  const [area, setArea] = useState(colaborador?.area ?? '')
  const [empresa, setEmpresa] = useState(colaborador?.empresa ?? '')
  const [regime, setRegime] = useState<RegimeTrabalho>(colaborador?.regime ?? 'clt')
  const [dataAdmissao, setDataAdmissao] = useState(toDateInput(colaborador?.dataAdmissao))
  const [salario, setSalario] = useState<number | ''>(typeof colaborador?.salario === 'number' ? colaborador.salario : '')
  const [status, setStatus] = useState<ColaboradorStatus>(colaborador?.status ?? 'ativo')
  const [indicadoPorNome, setIndicadoPorNome] = useState(colaborador?.indicadoPorNome ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const dataAdm = dataAdmissao ? Timestamp.fromDate(new Date(dataAdmissao + 'T00:00:00')) : null
      const base = {
        nome, email, cargo, area, empresa, regime,
        dataAdmissao: dataAdm,
        salario: typeof salario === 'number' ? salario : null,
        ...(indicadoPorNome.trim() ? { indicadoPorNome: indicadoPorNome.trim() } : {}),
        updatedAt: serverTimestamp(),
      }
      if (isEdit && colaborador) {
        await updateDoc(doc(db, 'colaboradores', colaborador.id), {
          ...base,
          status,
        })
      } else {
        await addDoc(collection(db, 'colaboradores'), {
          ...base,
          status: 'ativo',
          createdAt: serverTimestamp(),
        })
      }
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar colaborador' : 'Novo colaborador'}</h2>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field"><label>Nome *</label><input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Cargo *</label><input value={cargo} onChange={(e) => setCargo(e.target.value)} required /></div>
            <div className="field"><label>Área *</label><input value={area} onChange={(e) => setArea(e.target.value)} required /></div>
            <div className="field">
              <label>Empresa *</label>
              <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} required>
                <option value="">— selecione —</option>
                {EMPRESA_OPTIONS.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                {empresa && !(EMPRESA_OPTIONS as readonly string[]).includes(empresa) && (
                  <option value={empresa}>{empresa} (legado)</option>
                )}
              </select>
            </div>
            <div className="field">
              <label>Regime *</label>
              <select value={regime} onChange={(e) => setRegime(e.target.value as RegimeTrabalho)}>
                <option value="clt">CLT</option>
                <option value="pj">PJ</option>
                <option value="estagio">Estágio</option>
                <option value="freelancer">Freelancer</option>
              </select>
            </div>
            <div className="field"><label>Data de admissão *</label><input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} required /></div>
            <div className="field"><label>Salário (R$)</label><input type="number" min={0} step={0.01} value={salario} onChange={(e) => setSalario(e.target.value === '' ? '' : Number(e.target.value))} /></div>
            <div className="field full">
              <label>Indicado por (opcional)</label>
              <input value={indicadoPorNome} onChange={(e) => setIndicadoPorNome(e.target.value)} placeholder="Nome de quem indicou" />
              <small style={{ fontSize: 11, color: 'var(--mut)' }}>
                Se preenchido, o sistema mostra countdown de 90d para liberar bônus de indicação.
              </small>
            </div>
            {isEdit && (
              <div className="field">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as ColaboradorStatus)}>
                  <option value="ativo">Ativo</option>
                  <option value="ferias">Férias</option>
                  <option value="afastado">Afastado</option>
                  <option value="desligado">Desligado</option>
                </select>
              </div>
            )}
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar' : 'Cadastrar')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
