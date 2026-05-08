import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Colaborador, Desligamento, PrestadorStatus, RegimeTrabalho, Suspensao } from '../../types'
import {
  DESLIGAMENTO_TIPO_LABEL,
  EMPRESA_OPTIONS,
  PRESTADOR_STATUS_LABEL,
  REGIME_TRABALHO_LABEL,
  SUSPENSAO_TIPO_OPTIONS,
  getRegimePessoaLabel,
} from '../../types'

type ColaboradorStatus = PrestadorStatus

// Filtro de regime vindo da URL. O sidebar usa ?regime=clt ou ?regime=pj
// pra reaproveitar essa mesma página separando "Colaboradores (CLT)" de
// "Prestadores (PJ)" sem precisar duplicar componente nem mexer na coleção
// `colaboradores` (que continua guardando os dois tipos juntos).
type RegimeFiltroUrl = 'clt' | 'pj' | 'todos'

function parseRegimeFiltro(v: string | null): RegimeFiltroUrl {
  if (v === 'clt' || v === 'pj') return v
  return 'todos'
}

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

function suspensaoAtiva(c: Colaborador): Suspensao | null {
  const list = c.suspensoes || []
  return list.find(s => s.status === 'ativa') || null
}

export default function Colaboradores() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const regimeFiltro = parseRegimeFiltro(searchParams.get('regime'))

  const [items, setItems] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<string>('todos')
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Colaborador | null>(null)
  // Modais de movimentação (RH também solicita, igual gestor faz):
  const [openSuspensao, setOpenSuspensao] = useState<Colaborador | null>(null)
  const [encerrando, setEncerrando] = useState<{ colab: Colaborador; suspensao: Suspensao } | null>(null)
  const [desligando, setDesligando] = useState<Colaborador | null>(null)

  // Rótulos da página dependem do filtro de regime — não mudam dados,
  // só a comunicação visual (Topbar, botão "Novo …", placeholders, etc.).
  const labelSingular = regimeFiltro === 'pj' ? 'Prestador'
    : regimeFiltro === 'clt' ? 'Colaborador'
    : 'Colaborador / Prestador'
  const labelPlural = regimeFiltro === 'pj' ? 'Prestadores'
    : regimeFiltro === 'clt' ? 'Colaboradores'
    : 'Colaboradores e Prestadores'
  const novoBtnLabel = regimeFiltro === 'pj' ? '＋ Novo prestador (PJ)'
    : regimeFiltro === 'clt' ? '＋ Novo colaborador (CLT)'
    : '＋ Novo cadastro'
  const topbarIcon = regimeFiltro === 'pj' ? '◐' : '◉'

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
      // Filtro por regime (vem da URL, controla a aba do menu lateral)
      if (regimeFiltro === 'clt' && c.regime !== 'clt') return false
      if (regimeFiltro === 'pj' && c.regime !== 'pj') return false
      if (statusF !== 'todos' && c.status !== statusF) return false
      if (search) {
        const s = search.toLowerCase()
        if (!c.nome.toLowerCase().includes(s) && !c.cargo.toLowerCase().includes(s) && !c.area.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [items, search, statusF, regimeFiltro])

  // Card de bônus de indicação: lista colaboradores que vieram via indicação
  // e ainda têm countdown de 90d em aberto (ou já completaram).
  // Respeita o filtro de regime — só faz sentido para o universo da aba.
  const indicacoes = useMemo(() => {
    return items
      .filter(c => {
        if (c.status !== 'ativo' || !c.indicadoPorNome) return false
        if (regimeFiltro === 'clt' && c.regime !== 'clt') return false
        if (regimeFiltro === 'pj' && c.regime !== 'pj') return false
        return true
      })
      .map(c => ({
        c,
        diasRestantes: diasParaBonusIndicacao(c.dataAdmissao),
      }))
      .sort((a, b) => {
        const da = a.diasRestantes ?? 9999
        const db = b.diasRestantes ?? 9999
        return da - db
      })
  }, [items, regimeFiltro])

  async function excluir(c: Colaborador) {
    const tipo = getRegimePessoaLabel(c.regime).toLowerCase()
    if (!confirm(`Excluir o ${tipo} "${c.nome}"?\n\nEssa ação é permanente.`)) return
    try {
      await deleteDoc(doc(db, 'colaboradores', c.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir cadastro.')
    }
  }

  // Cancela uma solicitação de desligamento ainda pendente. Marca o doc em
  // `desligamentos` como `cancelado` e limpa o vínculo no colaborador,
  // assim o botão "Solicitar desligamento" volta a ficar disponível.
  async function cancelarDesligamentoPendente(c: Colaborador) {
    if (!c.desligamentoSolicitadoId) return
    if (!confirm(`Cancelar a solicitação de desligamento de "${c.nome}"?`)) return
    try {
      await updateDoc(doc(db, 'desligamentos', c.desligamentoSolicitadoId), {
        status: 'cancelado',
        atualizadoEm: serverTimestamp(),
      })
      await updateDoc(doc(db, 'colaboradores', c.id), {
        desligamentoSolicitadoId: null,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar solicitação.')
    }
  }

  return (
    <>
      <Topbar
        title={labelPlural}
        icon={topbarIcon}
        actions={<button className="tbtn pri" onClick={() => setOpenModal(true)}>{novoBtnLabel}</button>}
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
              <option value="contrato_suspenso">Contrato suspenso</option>
              <option value="afastado">Afastados</option>
              <option value="desligado">Desligados</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">{topbarIcon}</div>
              <div className="empty-ttl">Nenhum {labelSingular.toLowerCase()}</div>
              <div className="empty-sub">
                {regimeFiltro === 'pj'
                  ? 'Cadastre prestadores (PJ) para acompanhar.'
                  : regimeFiltro === 'clt'
                    ? 'Cadastre colaboradores (CLT) para acompanhar.'
                    : 'Cadastre colaboradores ou prestadores para acompanhar.'}
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
                    <th>Empresa</th>
                    <th>Regime</th>
                    <th>Admissão</th>
                    <th>Status</th>
                    <th style={{ width: 220 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const ativa = suspensaoAtiva(c)
                    const aguardandoDesligamento = !!c.desligamentoSolicitadoId
                    const statusBdg = c.status === 'ativo' ? 'ok'
                      : c.status === 'ferias' || c.status === 'contrato_suspenso' ? 'warn'
                      : c.status === 'afastado' ? 'info' : 'bad'
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/dp/colaboradores/${c.id}`} className="tdm" style={{ textDecoration: 'none', color: 'var(--fg)' }}>
                            {c.nome}
                          </Link>
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
                          <span className={`bdg ${statusBdg}`}>{PRESTADOR_STATUS_LABEL[c.status]}</span>
                          {aguardandoDesligamento && (
                            <div style={{ fontSize: 10, color: 'var(--warn)', marginTop: 3 }}>
                              Desligamento em análise
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="vstack" style={{ gap: 4 }}>
                            <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                              <Link to={`/dp/colaboradores/${c.id}`} className="tbtn" title="Abrir detalhe" style={{ height: 26 }}>
                                ▸ Abrir
                              </Link>
                              <button
                                type="button"
                                className="tbtn"
                                onClick={() => setEditing(c)}
                                title="Editar rápido"
                                style={{ height: 26 }}
                              >
                                ✎ Editar
                              </button>
                              <button
                                type="button"
                                className="tbtn"
                                onClick={() => excluir(c)}
                                title="Excluir cadastro"
                                style={{ height: 26, color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
                              >
                                🗑 Excluir
                              </button>
                            </div>
                            {/* RH agora também solicita movimentações daqui (PR #7).
                                Antes só o gestor podia, e o RH só "concluía" no detalhe.
                                Quando há desligamento pendente, o botão alterna pra
                                "Cancelar desligamento" em vez de ficar desabilitado. */}
                            <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                              {ativa ? (
                                <button
                                  type="button"
                                  className="tbtn"
                                  style={{ height: 24, fontSize: 11 }}
                                  onClick={() => setEncerrando({ colab: c, suspensao: ativa })}
                                  title={`Suspenso desde ${formatDate(ativa.inicio)}`}
                                >
                                  ⏵ Encerrar suspensão
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="tbtn"
                                  style={{ height: 24, fontSize: 11 }}
                                  onClick={() => setOpenSuspensao(c)}
                                  disabled={c.status === 'desligado'}
                                  title="Solicitar suspensão temporária de contrato"
                                >
                                  ⏸ Suspender
                                </button>
                              )}
                              {aguardandoDesligamento ? (
                                <button
                                  type="button"
                                  className="tbtn"
                                  style={{ height: 24, fontSize: 11, color: 'var(--warn)', borderColor: 'var(--warn)' }}
                                  onClick={() => cancelarDesligamentoPendente(c)}
                                  title="Cancelar a solicitação de desligamento atual"
                                >
                                  ⤺ Cancelar desligamento
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="tbtn"
                                  style={{ height: 24, fontSize: 11, color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
                                  onClick={() => setDesligando(c)}
                                  disabled={c.status === 'desligado'}
                                  title="Solicitar desligamento"
                                >
                                  ⤴ Solicitar desligamento
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {openModal && (
        <ColaboradorModal
          regimeInicial={regimeFiltro === 'pj' ? 'pj' : 'clt'}
          onClose={() => setOpenModal(false)}
        />
      )}
      {editing && <ColaboradorModal colaborador={editing} onClose={() => setEditing(null)} />}

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
      {desligando && profile && (
        <SolicitarDesligamentoModal
          colaborador={desligando}
          profileUid={profile.uid}
          profileName={profile.name || profile.email || ''}
          onClose={() => setDesligando(null)}
        />
      )}
    </>
  )
}

function ColaboradorModal({ colaborador, regimeInicial, onClose }: {
  colaborador?: Colaborador
  regimeInicial?: RegimeTrabalho
  onClose: () => void
}) {
  const isEdit = !!colaborador
  const [nome, setNome] = useState(colaborador?.nome ?? '')
  const [email, setEmail] = useState(colaborador?.email ?? '')
  const [cargo, setCargo] = useState(colaborador?.cargo ?? '')
  const [area, setArea] = useState(colaborador?.area ?? '')
  const [empresa, setEmpresa] = useState(colaborador?.empresa ?? '')
  const [regime, setRegime] = useState<RegimeTrabalho>(colaborador?.regime ?? regimeInicial ?? 'clt')
  const [dataAdmissao, setDataAdmissao] = useState(toDateInput(colaborador?.dataAdmissao))
  const [salario, setSalario] = useState<number | ''>(typeof colaborador?.salario === 'number' ? colaborador.salario : '')
  const [status, setStatus] = useState<ColaboradorStatus>(colaborador?.status ?? 'ativo')
  const [indicadoPorNome, setIndicadoPorNome] = useState(colaborador?.indicadoPorNome ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const tituloLabel = isEdit
    ? `Editar ${getRegimePessoaLabel(colaborador!.regime).toLowerCase()}`
    : `Novo ${getRegimePessoaLabel(regime).toLowerCase()}`

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
        <h2>{tituloLabel}</h2>
        {isEdit && colaborador && (
          <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>
            Para editar todos os campos (endereço, bancários, família, documentos, etc.) abra o detalhe completo.
          </div>
        )}
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
                <option value="clt">CLT (Colaborador)</option>
                <option value="pj">PJ (Prestador)</option>
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
                  <option value="contrato_suspenso">Contrato suspenso</option>
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

// ─── Modais de movimentação (PR #7) ─────────────────────────────────
//
// Espelha a UX do gestor (gestor/Equipe.tsx). Aqui o solicitante é o RH
// (mesmo schema com `solicitanteUid`/`solicitanteNome`). Usa
// getRegimePessoaLabel() pra deixar bem claro PJ vs CLT no copy.

function SolicitarDesligamentoModal({ colaborador, profileUid, profileName, onClose }: {
  colaborador: Colaborador
  profileUid: string
  profileName: string
  onClose: () => void
}) {
  const tipoPessoa = getRegimePessoaLabel(colaborador.regime).toLowerCase()
  const [tipo, setTipo] = useState<Desligamento['tipo']>('voluntario')
  const [motivo, setMotivo] = useState('')
  const [dataPrevista, setDataPrevista] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!motivo.trim()) { setErr('Informe o motivo do desligamento.'); return }
    setSaving(true); setErr(null)
    try {
      const dataTs = Timestamp.fromDate(new Date(dataPrevista + 'T00:00:00'))
      const novo = {
        colaboradorId: colaborador.id,
        colaboradorNome: colaborador.nome,
        empresa: colaborador.empresa,
        cargo: colaborador.cargo,
        motivo: motivo.trim(),
        tipo,
        dataPrevista: dataTs,
        solicitanteUid: profileUid,
        solicitanteNome: profileName,
        status: 'pendente' as const,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, 'desligamentos'), novo)
      await updateDoc(doc(db, 'colaboradores', colaborador.id), {
        desligamentoSolicitadoId: ref.id,
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao solicitar desligamento.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Solicitar desligamento</h2>
        <p>
          Solicitar desligamento do {tipoPessoa} <b>{colaborador.nome}</b>. A solicitação fica
          em "Desligamentos" para o RH concluir (data efetiva, anexos, etc.).
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as Desligamento['tipo'])}>
                {Object.entries(DESLIGAMENTO_TIPO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Data prevista *</label>
              <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} required />
            </div>
            <div className="field full">
              <label>Motivo / contexto *</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Pediu demissão, conversado em 1:1; último dia em 30/05."
                required
                rows={4}
              />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: 'var(--bad)' }}>
              {saving ? 'Solicitando…' : 'Solicitar desligamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SolicitarSuspensaoModal({ colaborador, profileUid, profileName, onClose }: {
  colaborador: Colaborador
  profileUid: string
  profileName: string
  onClose: () => void
}) {
  const tipoPessoa = getRegimePessoaLabel(colaborador.regime).toLowerCase()
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
        status: fimTs ? 'encerrada' : 'ativa',
        solicitanteUid: profileUid,
        solicitanteNome: profileName,
        criadoEm: Timestamp.now(),
        ...(fimTs ? { encerradoEm: Timestamp.now() } : {}),
      }
      await updateDoc(doc(db, 'colaboradores', colaborador.id), {
        suspensoes: arrayUnion(nova),
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
        <h2>Solicitar suspensão temporária de contrato</h2>
        <p>
          Registrar afastamento temporário do {tipoPessoa} <b>{colaborador.nome}</b>. A movimentação
          fica no histórico do cadastro.
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as Suspensao['tipo'])}>
                {SUSPENSAO_TIPO_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                Em branco = ainda não sabe. Encerre depois pelo botão "Encerrar suspensão".
              </small>
            </div>
            <div className="field full">
              <label>Motivo / observações *</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Atestado médico, INSS, licença particular, etc."
                required
                rows={4}
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
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    try {
      const fimTs = Timestamp.fromDate(new Date(fim + 'T00:00:00'))
      const novaLista = (colaborador.suspensoes || []).map(s => {
        if (s.id !== suspensao.id) return s
        return {
          ...s,
          fim: fimTs,
          status: 'encerrada' as const,
          encerradoEm: Timestamp.now(),
          ...(observacao.trim() ? { observacaoEncerramento: observacao.trim() } : {}),
        }
      })
      await updateDoc(doc(db, 'colaboradores', colaborador.id), {
        suspensoes: novaLista,
        // Se a pessoa estava como afastado/contrato_suspenso por causa
        // dessa suspensão, volta pra ativo.
        ...(colaborador.status === 'afastado' || colaborador.status === 'contrato_suspenso'
          ? { status: 'ativo' as const }
          : {}),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao encerrar suspensão.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Encerrar suspensão</h2>
        <p>
          Encerrar a suspensão de <b>{colaborador.nome}</b> iniciada em{' '}
          <b>{formatDate(suspensao.inicio)}</b>.
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Data de encerramento *</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} required />
            </div>
            <div className="field full">
              <label>Observação (opcional)</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: Retornou após alta médica."
                rows={3}
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
