import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc, arrayUnion, collection, doc, getDoc, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type {
  Colaborador, Desligamento, Estagiario, FeriasRequest,
  SolicitacaoRh, SolicitacaoTipo, Suspensao,
} from '../../types'
import {
  ESTAGIARIO_STATUS_LABEL, PRESTADOR_STATUS_LABEL,
  SOLICITACAO_TIPO_LABEL, SUSPENSAO_TIPO_LABEL, SUSPENSAO_TIPO_OPTIONS,
} from '../../types'

// Campos do estagiário que ele pode editar livremente. `bolsa` (salário do
// estagiário) NÃO entra — pedido do RH em maio/26.
const ESTAGIARIO_FIELDS_EDITAVEIS = [
  'telefone',
  'email',
  'observacoes',
] as const

function fmtDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function fmtDateTime(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try {
    return ts.toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

function diasRestantes(ts?: { toDate: () => Date } | null) {
  if (!ts) return null
  try {
    const d = ts.toDate()
    return Math.floor((d.getTime() - Date.now()) / 86400000)
  } catch { return null }
}

function proximoAniversario(dataAdmissao?: { toDate: () => Date } | null) {
  if (!dataAdmissao) return null
  try {
    const adm = dataAdmissao.toDate()
    const hoje = new Date()
    const proxAno = new Date(hoje.getFullYear(), adm.getMonth(), adm.getDate())
    if (proxAno.getTime() < hoje.getTime()) proxAno.setFullYear(hoje.getFullYear() + 1)
    const anos = proxAno.getFullYear() - adm.getFullYear()
    const dias = Math.floor((proxAno.getTime() - hoje.getTime()) / 86400000)
    return { data: proxAno, dias, anos }
  } catch { return null }
}

export default function MeuPerfil() {
  const { profile } = useAuth()
  const [pessoa, setPessoa] = useState<Estagiario | Colaborador | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.pessoaId || !profile?.pessoaTipo) {
      setLoading(false)
      return
    }
    const col = profile.pessoaTipo === 'estagiario' ? 'estagiarios' : 'colaboradores'
    const unsub = onSnapshot(
      doc(db, col, profile.pessoaId),
      (snap) => {
        if (snap.exists()) {
          setPessoa({ id: snap.id, ...(snap.data() as Omit<Estagiario, 'id'>) } as Estagiario | Colaborador)
        } else {
          setPessoa(null)
        }
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [profile?.pessoaId, profile?.pessoaTipo])

  if (loading) {
    return (
      <>
        <Topbar title="Meu perfil" icon="◔" />
        <div className="content"><div className="empty-state">Carregando…</div></div>
      </>
    )
  }

  if (!profile?.pessoaId || !pessoa) {
    return (
      <>
        <Topbar title="Meu perfil" icon="◔" />
        <div className="content">
          <div className="panel">
            <h3>Cadastro não encontrado</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Seu acesso foi criado mas ainda não está vinculado a um cadastro de
              estagiário, colaborador ou prestador. Procure o RH e peça pra eles
              acionarem "Criar acesso" na sua ficha em <code>DP</code>.
            </p>
          </div>
        </div>
      </>
    )
  }

  if (profile.pessoaTipo === 'estagiario') {
    return <PerfilEstagiario pessoa={pessoa as Estagiario} />
  }
  return <PerfilColabPrestador pessoa={pessoa as Colaborador} role={profile.role} />
}

// ─────────────────────────────────────────────────────────────────────────
// Portal: ESTAGIÁRIO
// ─────────────────────────────────────────────────────────────────────────
function PerfilEstagiario({ pessoa }: { pessoa: Estagiario }) {
  const { profile } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const dias = diasRestantes(pessoa.dataTermino)

  async function uploadContrato(file: File) {
    if (!profile) return
    setUploading(true)
    try {
      const path = `estagiarios/${pessoa.id}/contrato/${Date.now()}_${file.name}`
      const r = storageRef(storage, path)
      await uploadBytes(r, file)
      const url = await getDownloadURL(r)
      await updateDoc(doc(db, 'estagiarios', pessoa.id), {
        documentos: arrayUnion({
          id: doc(collection(db, '_ids')).id,
          nome: file.name,
          tipo: 'Contrato assinado',
          url,
          path,
          uploadedAt: Timestamp.now(),
          uploadedByUid: profile.uid,
          uploadedByName: profile.name,
        }),
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Erro ao subir contrato: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUploading(false)
    }
  }

  async function uploadDocumento(file: File) {
    if (!profile) return
    setUploading(true)
    try {
      const path = `estagiarios/${pessoa.id}/documentos/${Date.now()}_${file.name}`
      const r = storageRef(storage, path)
      await uploadBytes(r, file)
      const url = await getDownloadURL(r)
      await updateDoc(doc(db, 'estagiarios', pessoa.id), {
        documentos: arrayUnion({
          id: doc(collection(db, '_ids')).id,
          nome: file.name,
          tipo: 'Outro',
          url,
          path,
          uploadedAt: Timestamp.now(),
          uploadedByUid: profile.uid,
          uploadedByName: profile.name,
        }),
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Erro ao subir documento: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Topbar title="Meu perfil" icon="◔" />
      <div className="content">
        <div className="panel">
          <div className="hstack" style={{ alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{pessoa.nome}</h3>
            <span className="bdg info" style={{ marginLeft: 8 }}>
              {ESTAGIARIO_STATUS_LABEL[pessoa.status] || pessoa.status}
            </span>
            <button
              type="button"
              className="tbtn pri ml-auto"
              onClick={() => setEditOpen(true)}
            >
              ✎ Editar meus dados
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {pessoa.curso} · {pessoa.instituicao} · {pessoa.empresa}
          </div>
        </div>

        <div className="panel">
          <h3>Contrato e prazo</h3>
          <div className="form-grid">
            <Field label="Início do estágio" value={fmtDate(pessoa.dataInicio)} />
            <Field label="Término do estágio" value={fmtDate(pessoa.dataTermino)} />
            <Field
              label="Dias restantes"
              value={
                dias === null ? '—'
                  : dias < 0 ? `Encerrado há ${-dias} dia(s)`
                  : `${dias} dia(s)`
              }
            />
          </div>
        </div>

        <div className="panel">
          <h3>Gestor</h3>
          <div className="form-grid">
            <Field label="Nome" value={pessoa.gestorNome || '—'} />
            <Field
              label="Como falar com seu gestor"
              value="O contato direto do gestor aparece no seu onboarding e no e-mail corporativo."
            />
          </div>
        </div>

        <div className="panel">
          <div className="hstack" style={{ alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Contrato assinado</h3>
            <label className="tbtn pri ml-auto" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'Enviando…' : '⬆ Subir contrato'}
              <input
                type="file"
                accept="application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadContrato(f)
                  e.target.value = ''
                }}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Suba o PDF do contrato assinado. O RH recebe o arquivo automaticamente
            quando você envia.
          </p>
          <DocumentosList docs={pessoa.documentos ?? []} />
        </div>

        <div className="panel">
          <div className="hstack" style={{ alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Outros documentos</h3>
            <label className="tbtn ml-auto" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'Enviando…' : '⬆ Anexar documento'}
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadDocumento(f)
                  e.target.value = ''
                }}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            RG, comprovante de matrícula, carteira de vacinação etc.
          </p>
        </div>

        <div className="panel">
          <div className="hstack" style={{ alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Abrir solicitação ao RH</h3>
            <button type="button" className="tbtn pri ml-auto" onClick={() => setTicketOpen(true)}>
              ＋ Nova solicitação
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Use pra pedir documentos (declaração de estágio, etc.), tirar dúvidas
            de benefícios, ou qualquer outro assunto com o RH.
          </p>
          <MinhasSolicitacoes />
        </div>
      </div>

      {editOpen && (
        <EditarMeusDadosEstagiario
          pessoa={pessoa}
          onClose={() => setEditOpen(false)}
        />
      )}

      {ticketOpen && profile && (
        <NovaSolicitacaoModal
          pessoaId={pessoa.id}
          pessoaTipo="estagiario"
          onClose={() => setTicketOpen(false)}
        />
      )}
    </>
  )
}

function EditarMeusDadosEstagiario({
  pessoa, onClose,
}: { pessoa: Estagiario; onClose: () => void }) {
  const [form, setForm] = useState({
    telefone: pessoa.telefone ?? '',
    email: pessoa.email ?? '',
    observacoes: pessoa.observacoes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() }
      for (const k of ESTAGIARIO_FIELDS_EDITAVEIS) {
        patch[k] = form[k as keyof typeof form] || null
      }
      await updateDoc(doc(db, 'estagiarios', pessoa.id), patch)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar meus dados</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: -8 }}>
          Você pode atualizar contato e observações. Dados do contrato e bolsa
          são gerenciados pelo RH.
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="field">
              <label>E-mail pessoal</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={4}
                placeholder="Algo que o RH precisa saber?"
              />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Portal: COLABORADOR (CLT) e PRESTADOR (PJ) — mesma tela com flags
// ─────────────────────────────────────────────────────────────────────────
function PerfilColabPrestador({
  pessoa, role,
}: { pessoa: Colaborador; role: 'colaborador' | 'prestador' | string }) {
  const isPJ = role === 'prestador'
  const [ticketOpen, setTicketOpen] = useState(false)
  const [feriasOpen, setFeriasOpen] = useState(false)
  const [desligOpen, setDesligOpen] = useState(false)
  const [suspOpen, setSuspOpen] = useState(false)
  const aniv = proximoAniversario(pessoa.dataAdmissao)

  return (
    <>
      <Topbar title="Meu perfil" icon="◔" />
      <div className="content">
        <div className="panel">
          <div className="hstack" style={{ alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{pessoa.nome}</h3>
            <span className="bdg info" style={{ marginLeft: 8 }}>
              {PRESTADOR_STATUS_LABEL[pessoa.status] || pessoa.status}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {pessoa.cargo} · {pessoa.area} · {pessoa.empresa} · {isPJ ? 'PJ' : 'CLT'}
          </div>
        </div>

        <div className="panel">
          <h3>Contrato</h3>
          <div className="form-grid">
            <Field label="Admissão" value={fmtDate(pessoa.dataAdmissao)} />
            <Field label="Cargo" value={pessoa.cargo} />
            <Field label="Área" value={pessoa.area} />
            <Field label="Empresa" value={pessoa.empresa} />
            <Field label="E-mail corporativo" value={pessoa.emailCorporativo ?? '—'} />
            <Field label="Gestor" value={pessoa.gestorNome ?? '—'} />
            {isPJ && pessoa.nomeEmpresaPrestador && (
              <Field label="Razão social (PJ)" value={pessoa.nomeEmpresaPrestador} />
            )}
            {isPJ && pessoa.cnpj && <Field label="CNPJ" value={pessoa.cnpj} />}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Dados sensíveis (salário, dados bancários) são geridos pelo RH.
            Pra atualizar algum, abra uma solicitação ao RH.
          </p>
        </div>

        <div className="panel">
          <h3>Próximo aniversário de empresa</h3>
          {aniv ? (
            <div className="form-grid">
              <Field label="Data" value={fmtDate({ toDate: () => aniv.data } as { toDate: () => Date })} />
              <Field label="Daqui a" value={`${aniv.dias} dia(s)`} />
              <Field label="Completará" value={`${aniv.anos} ano(s) de casa`} />
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>Sem data de admissão registrada.</p>
          )}
        </div>

        <div className="panel">
          <h3>Histórico de suspensões / afastamentos</h3>
          <SuspensoesList suspensoes={pessoa.suspensoes ?? []} />
        </div>

        <div className="panel">
          <h3>Relatórios de avaliação</h3>
          <ExperienciaPanel pessoa={pessoa} />
        </div>

        <div className="panel">
          <h3>Ações disponíveis</h3>
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="tbtn pri" onClick={() => setTicketOpen(true)}>
              ＋ Abrir solicitação ao RH
            </button>
            {!isPJ && (
              <button type="button" className="tbtn" onClick={() => setFeriasOpen(true)}>
                ☀ Registrar férias
              </button>
            )}
            {isPJ && (
              <button type="button" className="tbtn" onClick={() => setSuspOpen(true)}>
                ⏸ Solicitar suspensão de contrato
              </button>
            )}
            <button
              type="button"
              className="tbtn"
              onClick={() => setDesligOpen(true)}
              style={{ color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
            >
              ⤬ Pedir desligamento
            </button>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Tudo passa pela aprovação do RH. Você consegue acompanhar o status
            na lista abaixo e nas seções específicas.
          </p>
        </div>

        {!isPJ && (
          <div className="panel">
            <h3>Minhas solicitações de férias</h3>
            <MinhasFerias />
          </div>
        )}

        <div className="panel">
          <h3>Minhas solicitações ao RH</h3>
          <MinhasSolicitacoes />
        </div>
      </div>

      {ticketOpen && (
        <NovaSolicitacaoModal
          pessoaId={pessoa.id}
          pessoaTipo={isPJ ? 'prestador' : 'colaborador'}
          onClose={() => setTicketOpen(false)}
        />
      )}

      {feriasOpen && (
        <NovaFeriasModal
          colaborador={pessoa}
          onClose={() => setFeriasOpen(false)}
        />
      )}

      {desligOpen && (
        <PedidoDesligamentoModal
          pessoa={pessoa}
          isPJ={isPJ}
          onClose={() => setDesligOpen(false)}
        />
      )}

      {suspOpen && (
        <SolicitarSuspensaoModal
          pessoa={pessoa}
          onClose={() => setSuspOpen(false)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Componentes compartilhados
// ─────────────────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  )
}

function DocumentosList({ docs }: { docs: NonNullable<Estagiario['documentos']> }) {
  if (!docs || docs.length === 0) {
    return <div className="empty-sub" style={{ fontSize: 12 }}>Nenhum documento enviado ainda.</div>
  }
  const ordenados = [...docs].sort((a, b) =>
    (b.uploadedAt?.toMillis?.() ?? 0) - (a.uploadedAt?.toMillis?.() ?? 0))
  return (
    <table>
      <thead>
        <tr>
          <th>Nome</th>
          <th>Tipo</th>
          <th>Enviado em</th>
          <th style={{ width: 60 }}></th>
        </tr>
      </thead>
      <tbody>
        {ordenados.map((d, i) => (
          <tr key={i}>
            <td><div className="tdm">{d.nome}</div></td>
            <td style={{ fontSize: 12, color: 'var(--mut)' }}>{d.tipo}</td>
            <td style={{ fontSize: 12, color: 'var(--mut)' }}>{fmtDateTime(d.uploadedAt)}</td>
            <td>
              <a href={d.url} target="_blank" rel="noreferrer" className="tbtn" style={{ height: 26 }}>
                Ver
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SuspensoesList({ suspensoes }: { suspensoes: Suspensao[] }) {
  if (!suspensoes || suspensoes.length === 0) {
    return <div className="empty-sub" style={{ fontSize: 12 }}>Sem suspensões registradas.</div>
  }
  const ordenadas = [...suspensoes].sort((a, b) =>
    (b.inicio?.toMillis?.() ?? 0) - (a.inicio?.toMillis?.() ?? 0))
  return (
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Início</th>
          <th>Fim</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {ordenadas.map((s) => (
          <tr key={s.id}>
            <td><div className="tdm">{SUSPENSAO_TIPO_LABEL[s.tipo] || s.tipo}</div></td>
            <td style={{ fontSize: 12 }}>{fmtDate(s.inicio)}</td>
            <td style={{ fontSize: 12 }}>{s.fim ? fmtDate(s.fim) : '—'}</td>
            <td>
              <span className={`bdg ${s.status === 'ativa' ? 'warn' : 'info'}`}>
                {s.status === 'ativa' ? 'Em aberto' : 'Encerrada'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ExperienciaPanel({ pessoa }: { pessoa: Colaborador }) {
  const e = pessoa.experiencia
  if (!e) {
    return <div className="empty-sub" style={{ fontSize: 12 }}>Nenhuma avaliação registrada ainda.</div>
  }
  return (
    <div className="form-grid">
      <Field label="Início do período" value={fmtDate(e.inicio)} />
      <Field
        label="Avaliação 45 dias"
        value={`${fmtDate(e.fim45)} · ${labelResultado(e.resultado45)}`}
      />
      <Field
        label="Avaliação 90 dias"
        value={`${fmtDate(e.fim90)} · ${labelResultado(e.resultado90)}`}
      />
      {e.observacoes && (
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Observações do RH</label>
          <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{e.observacoes}</div>
        </div>
      )}
    </div>
  )
}

function labelResultado(r?: 'positivo' | 'negativo' | 'pendente') {
  if (r === 'positivo') return 'Positivo'
  if (r === 'negativo') return 'Negativo'
  if (r === 'pendente') return 'Pendente'
  return '—'
}

// ─────────────────────────────────────────────────────────────────────────
// Solicitações ao RH
// ─────────────────────────────────────────────────────────────────────────
function MinhasSolicitacoes() {
  const { profile } = useAuth()
  const [items, setItems] = useState<SolicitacaoRh[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.uid) return
    const q = query(
      collection(db, 'solicitacoes_rh'),
      where('solicitanteUid', '==', profile.uid),
    )
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SolicitacaoRh, 'id'>) }))
      list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [profile?.uid])

  if (loading) return <div className="empty-sub" style={{ fontSize: 12 }}>Carregando…</div>
  if (items.length === 0) {
    return <div className="empty-sub" style={{ fontSize: 12 }}>Você ainda não abriu nenhuma solicitação.</div>
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Assunto</th>
          <th>Tipo</th>
          <th>Aberta em</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map(s => (
          <tr key={s.id}>
            <td><div className="tdm">{s.titulo}</div></td>
            <td style={{ fontSize: 12, color: 'var(--mut)' }}>
              {SOLICITACAO_TIPO_LABEL[s.tipo] || s.tipo}
            </td>
            <td style={{ fontSize: 12, color: 'var(--mut)' }}>{fmtDateTime(s.criadoEm)}</td>
            <td>
              <SolicitacaoStatusBadge status={s.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SolicitacaoStatusBadge({ status }: { status: SolicitacaoRh['status'] }) {
  const map: Record<SolicitacaoRh['status'], { cls: string; label: string }> = {
    aberta: { cls: 'warn', label: 'Aberta' },
    em_andamento: { cls: 'info', label: 'Em andamento' },
    resolvida: { cls: 'ok', label: 'Resolvida' },
    cancelada: { cls: '', label: 'Cancelada' },
  }
  const v = map[status] || map.aberta
  return <span className={`bdg ${v.cls}`}>{v.label}</span>
}

function NovaSolicitacaoModal({
  pessoaId, pessoaTipo, onClose,
}: {
  pessoaId: string
  pessoaTipo: 'estagiario' | 'colaborador' | 'prestador'
  onClose: () => void
}) {
  const { profile } = useAuth()
  const [tipo, setTipo] = useState<SolicitacaoTipo>('duvida')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setErr(null)
    if (titulo.trim().length < 3) {
      setErr('Dê um assunto (mínimo 3 caracteres).')
      return
    }
    if (mensagem.trim().length < 10) {
      setErr('Descreva o que você precisa (mínimo 10 caracteres).')
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'solicitacoes_rh'), {
        tipo,
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        solicitanteUid: profile.uid,
        solicitanteNome: profile.name,
        solicitanteEmail: profile.email,
        solicitanteTipo: pessoaTipo,
        pessoaId,
        status: 'aberta',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar solicitação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nova solicitação ao RH</h2>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as SolicitacaoTipo)}>
                {Object.entries(SOLICITACAO_TIPO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Assunto *</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Solicitar declaração de estágio"
                required
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Descrição *</label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={5}
                placeholder="Explique pro RH o que você precisa"
                required
                minLength={10}
              />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enviando…' : 'Enviar solicitação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Férias (só colaborador CLT)
// ─────────────────────────────────────────────────────────────────────────
function MinhasFerias() {
  const { profile } = useAuth()
  const [items, setItems] = useState<FeriasRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.uid) return
    const q = query(collection(db, 'ferias'), where('solicitanteUid', '==', profile.uid))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<FeriasRequest, 'id'>) }))
      list.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [profile?.uid])

  if (loading) return <div className="empty-sub" style={{ fontSize: 12 }}>Carregando…</div>
  if (items.length === 0) {
    return <div className="empty-sub" style={{ fontSize: 12 }}>Nenhum pedido de férias registrado.</div>
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Início</th>
          <th>Fim</th>
          <th>Dias</th>
          <th>Status</th>
          <th>Resposta do RH</th>
        </tr>
      </thead>
      <tbody>
        {items.map(f => (
          <tr key={f.id}>
            <td style={{ fontSize: 12 }}>{fmtDate(f.inicio)}</td>
            <td style={{ fontSize: 12 }}>{fmtDate(f.fim)}</td>
            <td style={{ fontSize: 12 }}>{f.dias}</td>
            <td><FeriasStatusBadge status={f.status} /></td>
            <td style={{ fontSize: 12, color: 'var(--mut)' }}>{f.respostaRh || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FeriasStatusBadge({ status }: { status: FeriasRequest['status'] }) {
  const map: Record<FeriasRequest['status'], { cls: string; label: string }> = {
    pendente: { cls: 'warn', label: 'Pendente' },
    aprovada: { cls: 'ok', label: 'Aprovada' },
    recusada: { cls: 'bad', label: 'Recusada' },
    cancelada: { cls: '', label: 'Cancelada' },
  }
  const v = map[status] || map.pendente
  return <span className={`bdg ${v.cls}`}>{v.label}</span>
}

function NovaFeriasModal({
  colaborador, onClose,
}: { colaborador: Colaborador; onClose: () => void }) {
  const { profile } = useAuth()
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const dias = useMemo(() => {
    if (!inicio || !fim) return 0
    const a = new Date(inicio)
    const b = new Date(fim)
    if (b.getTime() < a.getTime()) return 0
    return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1
  }, [inicio, fim])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setErr(null)
    if (!inicio || !fim) { setErr('Informe início e fim.'); return }
    if (dias < 1) { setErr('A data fim precisa ser depois da data início.'); return }
    setSaving(true)
    try {
      await addDoc(collection(db, 'ferias'), {
        colaboradorId: colaborador.id,
        colaboradorNome: colaborador.nome,
        colaboradorEmail: colaborador.email ?? '',
        solicitanteUid: profile.uid,
        inicio: Timestamp.fromDate(new Date(inicio)),
        fim: Timestamp.fromDate(new Date(fim)),
        dias,
        observacoes: obs.trim() || null,
        status: 'pendente',
        criadoEm: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Registrar férias</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: -8 }}>
          O RH aprova ou recusa o pedido. Você acompanha o status na lista
          "Minhas solicitações de férias".
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Início *</label>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
            </div>
            <div className="field">
              <label>Fim *</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Total</label>
              <div style={{ fontSize: 13 }}>{dias} dia(s)</div>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Observações</label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
                placeholder="Algo importante pro RH?"
              />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enviando…' : 'Enviar pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Pedido de desligamento (qualquer role)
// ─────────────────────────────────────────────────────────────────────────
function PedidoDesligamentoModal({
  pessoa, isPJ, onClose,
}: { pessoa: Colaborador; isPJ: boolean; onClose: () => void }) {
  const { profile } = useAuth()
  const [motivo, setMotivo] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setErr(null)
    if (motivo.trim().length < 10) { setErr('Descreva o motivo (mín. 10 caracteres).'); return }
    if (!dataPrevista) { setErr('Informe a data prevista.'); return }
    setSaving(true)
    try {
      const desligDoc: Omit<Desligamento, 'id'> = {
        colaboradorId: pessoa.id,
        colaboradorNome: pessoa.nome,
        empresa: pessoa.empresa,
        cargo: pessoa.cargo,
        contratadoTipo: 'colaborador',
        motivo: motivo.trim(),
        tipo: 'voluntario',
        dataPrevista: Timestamp.fromDate(new Date(dataPrevista)),
        solicitanteUid: profile.uid,
        solicitanteNome: profile.name,
        status: 'pendente',
        criadoEm: Timestamp.now(),
        atualizadoEm: Timestamp.now(),
      }
      const ref = await addDoc(collection(db, 'desligamentos'), {
        ...desligDoc,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })
      await updateDoc(doc(db, 'colaboradores', pessoa.id), {
        desligamentoSolicitadoId: ref.id,
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar pedido.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Pedir desligamento</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: -8 }}>
          {isPJ
            ? 'Você está solicitando o encerramento do contrato PJ. O RH precisa aprovar.'
            : 'Você está solicitando seu desligamento. O RH precisa aprovar.'}
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Data prevista *</label>
              <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Motivo *</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={5}
                placeholder="Por que você está pedindo desligamento?"
                required
                minLength={10}
              />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }}
            >
              {saving ? 'Enviando…' : 'Confirmar pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Suspensão temporária de contrato (só prestador PJ)
// ─────────────────────────────────────────────────────────────────────────
function SolicitarSuspensaoModal({
  pessoa, onClose,
}: { pessoa: Colaborador; onClose: () => void }) {
  const { profile } = useAuth()
  const [tipo, setTipo] = useState<Suspensao['tipo']>('licenca')
  const [motivo, setMotivo] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setErr(null)
    if (motivo.trim().length < 5) { setErr('Descreva o motivo (mín. 5 caracteres).'); return }
    if (!inicio) { setErr('Informe a data de início.'); return }
    setSaving(true)
    try {
      const susp: Suspensao = {
        id: doc(collection(db, '_ids')).id,
        tipo,
        motivo: motivo.trim(),
        inicio: Timestamp.fromDate(new Date(inicio)),
        fim: fim ? Timestamp.fromDate(new Date(fim)) : undefined,
        status: 'ativa',
        solicitanteUid: profile.uid,
        solicitanteNome: profile.name,
        criadoEm: Timestamp.now(),
      }
      await updateDoc(doc(db, 'colaboradores', pessoa.id), {
        suspensoes: arrayUnion(susp),
        status: 'contrato_suspenso',
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao solicitar suspensão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Solicitar suspensão de contrato</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: -8 }}>
          Suspensão temporária do contrato PJ. Fica registrada no seu histórico
          e o RH acompanha. Sem aprovação formal — o pedido já vale como aviso.
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as Suspensao['tipo'])}>
                {SUSPENSAO_TIPO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Início *</label>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
            </div>
            <div className="field">
              <label>Fim previsto</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Motivo *</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={4}
                required
                minLength={5}
              />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enviando…' : 'Confirmar suspensão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Garante uma lazy reference pra evitar tree-shaking eliminar imports de
// utilities/tipos só usados pra type-checking.
void getDoc
void setDoc
void orderBy
