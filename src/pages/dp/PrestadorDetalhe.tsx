import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  arrayUnion, doc, onSnapshot, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import { uploadFile } from '../../utils/storage'
import type {
  Colaborador, DocumentoDigitalizado, Filho, FormacaoEducacional,
  HistoricoCargoEntry, HistoricoSalarioEntry, IdiomaFalado,
  PrestadorStatus, RegimeTrabalho, Suspensao,
} from '../../types'
import {
  CONTA_TIPO_LABEL, EMPRESA_OPTIONS, ESTADO_CIVIL_LABEL, FORMACAO_LABEL,
  GENERO_LABEL, NIVEL_IDIOMA_LABEL, PIX_TIPO_LABEL, PRESTADOR_STATUS_LABEL,
  RACA_LABEL, REGIME_TRABALHO_LABEL, SUSPENSAO_TIPO_LABEL, TIPO_PAGAMENTO_LABEL,
  TIPO_UNIAO_LABEL, getRegimePessoaLabel,
} from '../../types'

// Página de detalhe do prestador (a.k.a. colaborador). Layout em tabs com
// dados pessoais, endereço, bancários, família, documentos, históricos
// imutáveis (cargo/salário) e suspensões. Coleção Firestore continua
// `colaboradores` por compat.

type TabKey =
  | 'principal'
  | 'endereco'
  | 'bancarios'
  | 'familia'
  | 'escolaridade'
  | 'documentos'
  | 'historicos'
  | 'suspensoes'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'principal', label: 'Principal' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'bancarios', label: 'Bancários' },
  { key: 'familia', label: 'Família' },
  { key: 'escolaridade', label: 'Escolaridade & Idiomas' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'historicos', label: 'Movimentações' },
  { key: 'suspensoes', label: 'Suspensões' },
]

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}
function fmtDateTime(ts?: Timestamp | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleString('pt-BR') } catch { return '—' }
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
function fmtMoney(n?: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function PrestadorDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [p, setP] = useState<Colaborador | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('principal')

  useEffect(() => {
    if (!id) return
    const u = onSnapshot(doc(db, 'colaboradores', id), (snap) => {
      if (!snap.exists()) { setP(null); setLoading(false); return }
      setP({ id: snap.id, ...(snap.data() as Omit<Colaborador, 'id'>) })
      setLoading(false)
    }, () => setLoading(false))
    return u
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar title="Cadastro" icon="◉" />
        <div className="content"><div className="empty-state">Carregando…</div></div>
      </>
    )
  }
  if (!p) {
    return (
      <>
        <Topbar title="Cadastro" icon="◉" />
        <div className="content">
          <div className="empty">
            <div className="empty-ico">◉</div>
            <div className="empty-ttl">Cadastro não encontrado</div>
            <div className="empty-sub">
              <Link to="/dp/colaboradores" style={{ color: 'var(--g600)' }}>← Voltar para lista</Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Rótulo da pessoa varia conforme regime: PJ → Prestador, CLT → Colaborador.
  const labelPessoa = getRegimePessoaLabel(p.regime)
  // Volta pra lista filtrada por regime, pra continuar na mesma "aba" do menu.
  const voltarHref = p.regime === 'pj'
    ? '/dp/colaboradores?regime=pj'
    : '/dp/colaboradores?regime=clt'
  const iconePessoa = p.regime === 'pj' ? '◐' : '◉'

  return (
    <>
      <Topbar
        title={`${p.nome} · ${labelPessoa}`}
        icon={iconePessoa}
        actions={
          <button className="tbtn" onClick={() => navigate(voltarHref)}>← Voltar</button>
        }
      />
      <div className="content">
        <PrestadorHeader p={p} />

        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="panel-scroll"
            style={{
              display: 'flex',
              gap: 4,
              padding: '8px 10px',
              borderBottom: '1px solid var(--bd)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                className="tbtn"
                onClick={() => setTab(t.key)}
                style={{
                  background: tab === t.key ? 'var(--g600)' : 'transparent',
                  color: tab === t.key ? '#fff' : 'var(--fg)',
                  borderColor: tab === t.key ? 'var(--g600)' : 'var(--bd)',
                  height: 30,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {tab === 'principal' && <TabPrincipal p={p} />}
            {tab === 'endereco' && <TabEndereco p={p} />}
            {tab === 'bancarios' && <TabBancarios p={p} />}
            {tab === 'familia' && <TabFamilia p={p} />}
            {tab === 'escolaridade' && <TabEscolaridade p={p} />}
            {tab === 'documentos' && <TabDocumentos p={p} />}
            {tab === 'historicos' && <TabHistoricos p={p} />}
            {tab === 'suspensoes' && <TabSuspensoes p={p} />}
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────── Header com foto ───────────────────────────
function PrestadorHeader({ p }: { p: Colaborador }) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function uploadFoto(file: File) {
    setUploading(true); setErr(null)
    try {
      const r = await uploadFile(file, `prestadores/${p.id}/foto`)
      await updateDoc(doc(db, 'colaboradores', p.id), {
        fotoUrl: r.url, fotoPath: r.path, updatedAt: serverTimestamp(),
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro no upload da foto.')
    } finally { setUploading(false) }
  }

  const statusBdg = p.status === 'ativo' ? 'ok'
    : p.status === 'ferias' || p.status === 'contrato_suspenso' ? 'warn'
    : p.status === 'afastado' ? 'info' : 'bad'

  return (
    <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        {p.fotoUrl ? (
          <img
            src={p.fotoUrl}
            alt={p.nome}
            style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bd)' }}
          />
        ) : (
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'var(--card2)', border: '2px solid var(--bd)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 700, color: 'var(--mut)',
          }}>
            {p.nome.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        )}
        <label className="tbtn" style={{ position: 'absolute', bottom: -4, right: -4, height: 26, padding: '0 8px', cursor: 'pointer' }}>
          {uploading ? '…' : '📷'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && uploadFoto(e.target.files[0])}
            disabled={uploading}
          />
        </label>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.nome}</div>
        <div style={{ fontSize: 13, color: 'var(--mut)' }}>
          {p.cargo} · {p.area} · {p.empresa}
        </div>
        <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>
          {REGIME_TRABALHO_LABEL[p.regime]} · Admissão {fmtDate(p.dataAdmissao)}
          {p.gestorNome && <> · Gestor: {p.gestorNome}</>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span className={`bdg ${statusBdg}`} style={{ fontSize: 12 }}>{PRESTADOR_STATUS_LABEL[p.status]}</span>
        {p.indicadoPorNome && (
          <span style={{ fontSize: 10, color: 'var(--g600)' }}>★ Indicado por {p.indicadoPorNome}</span>
        )}
      </div>
      {err && <div className="error-text" style={{ width: '100%' }}>{err}</div>}
    </div>
  )
}

// ─────────────────────────── Tab Principal ───────────────────────────
function TabPrincipal({ p }: { p: Colaborador }) {
  const [editing, setEditing] = useState(false)
  if (editing) return <FormPrincipal p={p} onClose={() => setEditing(false)} />
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="tbtn pri" onClick={() => setEditing(true)}>✎ Editar dados</button>
      </div>
      <div className="form-grid">
        <Field label="Nome">{p.nome}</Field>
        <Field label="E-mail pessoal">{p.email || '—'}</Field>
        <Field label="E-mail corporativo">{p.emailCorporativo || '—'}</Field>
        <Field label="Telefone / Celular">{p.telefone || '—'}</Field>
        <Field label="CPF">{p.cpf || '—'}</Field>
        <Field label="RG">{p.rg || '—'}</Field>
        <Field label="Data de nascimento">{fmtDate(p.dataNascimento)}</Field>
        <Field label="Gênero">{p.genero ? GENERO_LABEL[p.genero] : '—'}</Field>
        <Field label="Raça/Cor">{p.raca ? RACA_LABEL[p.raca] : '—'}</Field>
        <Field label="Nacionalidade">{p.nacionalidade || '—'}</Field>
        <Field label="Naturalidade">{p.naturalidade || '—'}</Field>
        <Field label="PCD">{p.pcd ? `Sim${p.pcdDescricao ? ` — ${p.pcdDescricao}` : ''}` : 'Não'}</Field>
        <Field label="Cargo">{p.cargo}</Field>
        <Field label="Área">{p.area}</Field>
        <Field label="Empresa do grupo">{p.empresa}</Field>
        <Field label="Regime">{REGIME_TRABALHO_LABEL[p.regime]}</Field>
        <Field label="Salário / Pró-labore">{fmtMoney(p.salario)}</Field>
        <Field label="Empresa do prestador (PJ)">{p.nomeEmpresaPrestador || '—'}</Field>
        <Field label="CNPJ">{p.cnpj || '—'}</Field>
        <Field label="Data de admissão">{fmtDate(p.dataAdmissao)}</Field>
        <Field label="Data de demissão">{fmtDate(p.dataDemissao)}</Field>
        <Field label="Superior imediato">{p.superiorNome || p.gestorNome || '—'}</Field>
        <Field label="Contato de emergência" wide>
          {p.contatoEmergencia?.nome ? (
            <>
              {p.contatoEmergencia.nome}
              {p.contatoEmergencia.parentesco && <> ({p.contatoEmergencia.parentesco})</>}
              {p.contatoEmergencia.telefone && <> · {p.contatoEmergencia.telefone}</>}
            </>
          ) : '—'}
        </Field>
        <Field label="Observações" wide>
          {p.observacoes ? <span style={{ whiteSpace: 'pre-wrap' }}>{p.observacoes}</span> : '—'}
        </Field>
      </div>
    </div>
  )
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  )
}

function FormPrincipal({ p, onClose }: { p: Colaborador; onClose: () => void }) {
  const { profile } = useAuth()
  const [nome, setNome] = useState(p.nome)
  const [email, setEmail] = useState(p.email ?? '')
  const [emailCorp, setEmailCorp] = useState(p.emailCorporativo ?? '')
  const [telefone, setTelefone] = useState(p.telefone ?? '')
  const [cpf, setCpf] = useState(p.cpf ?? '')
  const [rg, setRg] = useState(p.rg ?? '')
  const [dataNasc, setDataNasc] = useState(toDateInput(p.dataNascimento))
  const [genero, setGenero] = useState<Colaborador['genero'] | ''>(p.genero ?? '')
  const [raca, setRaca] = useState<Colaborador['raca'] | ''>(p.raca ?? '')
  const [nacionalidade, setNac] = useState(p.nacionalidade ?? '')
  const [naturalidade, setNat] = useState(p.naturalidade ?? '')
  const [pcd, setPcd] = useState(p.pcd ?? false)
  const [pcdDescricao, setPcdDesc] = useState(p.pcdDescricao ?? '')
  const [cargo, setCargo] = useState(p.cargo)
  const [area, setArea] = useState(p.area)
  const [empresa, setEmpresa] = useState(p.empresa)
  const [regime, setRegime] = useState<RegimeTrabalho>(p.regime)
  const [salario, setSalario] = useState<number | ''>(typeof p.salario === 'number' ? p.salario : '')
  const [nomeEmpresaPrestador, setNomeEmpPrest] = useState(p.nomeEmpresaPrestador ?? '')
  const [cnpj, setCnpj] = useState(p.cnpj ?? '')
  const [dataAdm, setDataAdm] = useState(toDateInput(p.dataAdmissao))
  const [dataDem, setDataDem] = useState(toDateInput(p.dataDemissao))
  const [status, setStatus] = useState<PrestadorStatus>(p.status)
  const [superiorNome, setSuperiorNome] = useState(p.superiorNome ?? '')
  const [observacoes, setObservacoes] = useState(p.observacoes ?? '')
  const [emergNome, setEmergNome] = useState(p.contatoEmergencia?.nome ?? '')
  const [emergParent, setEmergParent] = useState(p.contatoEmergencia?.parentesco ?? '')
  const [emergTel, setEmergTel] = useState(p.contatoEmergencia?.telefone ?? '')
  const [salarioMotivo, setSalarioMotivo] = useState('')
  const [cargoMotivo, setCargoMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const cargoMudou = cargo.trim() !== (p.cargo ?? '').trim()
  const salarioMudou = (typeof salario === 'number' ? salario : null) !== (typeof p.salario === 'number' ? p.salario : null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    try {
      const payload: Record<string, unknown> = {
        nome, cargo, area, empresa, regime, status,
        email: email || null,
        emailCorporativo: emailCorp || null,
        telefone: telefone || null,
        cpf: cpf || null,
        rg: rg || null,
        dataNascimento: dataNasc ? Timestamp.fromDate(new Date(dataNasc + 'T00:00:00')) : null,
        genero: genero || null,
        raca: raca || null,
        nacionalidade: nacionalidade || null,
        naturalidade: naturalidade || null,
        pcd,
        pcdDescricao: pcd ? (pcdDescricao || null) : null,
        salario: typeof salario === 'number' ? salario : null,
        nomeEmpresaPrestador: nomeEmpresaPrestador || null,
        cnpj: cnpj || null,
        dataAdmissao: dataAdm ? Timestamp.fromDate(new Date(dataAdm + 'T00:00:00')) : null,
        dataDemissao: dataDem ? Timestamp.fromDate(new Date(dataDem + 'T00:00:00')) : null,
        superiorNome: superiorNome || null,
        observacoes: observacoes || null,
        contatoEmergencia: (emergNome || emergParent || emergTel) ? {
          nome: emergNome || null,
          parentesco: emergParent || null,
          telefone: emergTel || null,
        } : null,
        updatedAt: serverTimestamp(),
      }

      // Append em históricos imutáveis quando cargo/salário mudarem.
      const updates: Record<string, unknown> = { ...payload }
      const nowTs = Timestamp.now()
      const byUid = profile?.uid ?? 'sistema'
      const byName = profile?.name ?? 'Sistema'

      if (cargoMudou) {
        const entry: HistoricoCargoEntry = {
          id: genId(),
          cargoAnterior: p.cargo,
          cargoNovo: cargo,
          motivo: cargoMotivo || undefined,
          vigenciaEm: nowTs,
          registradoEm: nowTs,
          registradoPorUid: byUid,
          registradoPorNome: byName,
        }
        updates.historicoCargo = arrayUnion(entry)
      }
      if (salarioMudou && typeof salario === 'number') {
        const entry: HistoricoSalarioEntry = {
          id: genId(),
          salarioAnterior: typeof p.salario === 'number' ? p.salario : undefined,
          salarioNovo: salario,
          motivo: salarioMotivo || undefined,
          vigenciaEm: nowTs,
          registradoEm: nowTs,
          registradoPorUid: byUid,
          registradoPorNome: byName,
        }
        updates.historicoSalario = arrayUnion(entry)
      }

      await updateDoc(doc(db, 'colaboradores', p.id), updates)
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="row-gap-14">
      {err && <div className="error-text">{err}</div>}
      <div className="form-grid">
        <div className="field"><label>Nome *</label><input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
        <div className="field"><label>E-mail pessoal</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>E-mail corporativo</label><input type="email" value={emailCorp} onChange={(e) => setEmailCorp(e.target.value)} /></div>
        <div className="field"><label>Telefone / celular</label><input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
        <div className="field"><label>CPF</label><input value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
        <div className="field"><label>RG</label><input value={rg} onChange={(e) => setRg(e.target.value)} /></div>
        <div className="field"><label>Data de nascimento</label><input type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} /></div>
        <div className="field">
          <label>Gênero</label>
          <select value={genero} onChange={(e) => setGenero(e.target.value as Colaborador['genero'])}>
            <option value="">— selecione —</option>
            {Object.entries(GENERO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Raça / Cor</label>
          <select value={raca} onChange={(e) => setRaca(e.target.value as Colaborador['raca'])}>
            <option value="">— selecione —</option>
            {Object.entries(RACA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>Nacionalidade</label><input value={nacionalidade} onChange={(e) => setNac(e.target.value)} placeholder="Ex.: Brasileira" /></div>
        <div className="field"><label>Naturalidade</label><input value={naturalidade} onChange={(e) => setNat(e.target.value)} placeholder="Cidade-UF" /></div>
        <div className="field" style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={pcd} onChange={(e) => setPcd(e.target.checked)} />
            Pessoa com deficiência
          </label>
          {pcd && <input value={pcdDescricao} onChange={(e) => setPcdDesc(e.target.value)} placeholder="Descrição (opcional)" />}
        </div>
        <div className="field"><label>Cargo *</label><input value={cargo} onChange={(e) => setCargo(e.target.value)} required /></div>
        {cargoMudou && (
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Motivo da mudança de cargo (vai pro histórico)</label>
            <input value={cargoMotivo} onChange={(e) => setCargoMotivo(e.target.value)} placeholder="Ex.: promoção, mudança de área…" />
          </div>
        )}
        <div className="field"><label>Área *</label><input value={area} onChange={(e) => setArea(e.target.value)} required /></div>
        <div className="field">
          <label>Empresa do grupo *</label>
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
            {Object.entries(REGIME_TRABALHO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Salário / Pró-labore (R$)</label>
          <input type="number" min={0} step={0.01} value={salario} onChange={(e) => setSalario(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        {salarioMudou && (
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Motivo da mudança de salário (vai pro histórico)</label>
            <input value={salarioMotivo} onChange={(e) => setSalarioMotivo(e.target.value)} placeholder="Ex.: dissídio, ajuste por mérito…" />
          </div>
        )}
        <div className="field"><label>Empresa do prestador (PJ)</label><input value={nomeEmpresaPrestador} onChange={(e) => setNomeEmpPrest(e.target.value)} /></div>
        <div className="field"><label>CNPJ</label><input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
        <div className="field"><label>Data de admissão</label><input type="date" value={dataAdm} onChange={(e) => setDataAdm(e.target.value)} /></div>
        <div className="field"><label>Data de demissão</label><input type="date" value={dataDem} onChange={(e) => setDataDem(e.target.value)} /></div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as PrestadorStatus)}>
            {Object.entries(PRESTADOR_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>Superior imediato</label><input value={superiorNome} onChange={(e) => setSuperiorNome(e.target.value)} /></div>

        <div className="field" style={{ gridColumn: '1 / -1', marginTop: 6 }}>
          <label style={{ fontWeight: 700 }}>Contato de emergência</label>
        </div>
        <div className="field"><label>Nome</label><input value={emergNome} onChange={(e) => setEmergNome(e.target.value)} /></div>
        <div className="field"><label>Parentesco</label><input value={emergParent} onChange={(e) => setEmergParent(e.target.value)} /></div>
        <div className="field"><label>Telefone</label><input value={emergTel} onChange={(e) => setEmergTel(e.target.value)} /></div>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Observações</label>
          <textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>
      </div>
      <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  )
}

// ─────────────────────────── Tab Endereço ───────────────────────────
function TabEndereco({ p }: { p: Colaborador }) {
  const e = p.endereco ?? {}
  const [editing, setEditing] = useState(false)
  const [cep, setCep] = useState(e.cep ?? '')
  const [logr, setLogr] = useState(e.logradouro ?? '')
  const [num, setNum] = useState(e.numero ?? '')
  const [comp, setComp] = useState(e.complemento ?? '')
  const [bairro, setBairro] = useState(e.bairro ?? '')
  const [cidade, setCidade] = useState(e.cidade ?? '')
  const [uf, setUf] = useState(e.uf ?? '')
  const [pais, setPais] = useState(e.pais ?? 'Brasil')
  const [saving, setSaving] = useState(false)

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      await updateDoc(doc(db, 'colaboradores', p.id), {
        endereco: {
          cep: cep || null, logradouro: logr || null, numero: num || null,
          complemento: comp || null, bairro: bairro || null, cidade: cidade || null,
          uf: uf || null, pais: pais || null,
        },
        updatedAt: serverTimestamp(),
      })
      setEditing(false)
    } finally { setSaving(false) }
  }

  if (!editing) {
    const linha1 = [e.logradouro, e.numero].filter(Boolean).join(', ')
    const linha2 = [e.complemento].filter(Boolean).join(', ')
    const linha3 = [e.bairro, e.cidade, e.uf].filter(Boolean).join(' · ')
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button className="tbtn pri" onClick={() => setEditing(true)}>✎ Editar endereço</button>
        </div>
        <div className="form-grid">
          <Field label="CEP">{e.cep || '—'}</Field>
          <Field label="País">{e.pais || '—'}</Field>
          <Field label="Endereço" wide>{linha1 || '—'}</Field>
          <Field label="Complemento" wide>{linha2 || '—'}</Field>
          <Field label="Bairro / Cidade / UF" wide>{linha3 || '—'}</Field>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={salvar} className="row-gap-14">
      <div className="form-grid">
        <div className="field"><label>CEP</label><input value={cep} onChange={(ev) => setCep(ev.target.value)} /></div>
        <div className="field"><label>País</label><input value={pais} onChange={(ev) => setPais(ev.target.value)} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Logradouro</label><input value={logr} onChange={(ev) => setLogr(ev.target.value)} /></div>
        <div className="field"><label>Número</label><input value={num} onChange={(ev) => setNum(ev.target.value)} /></div>
        <div className="field"><label>Complemento</label><input value={comp} onChange={(ev) => setComp(ev.target.value)} /></div>
        <div className="field"><label>Bairro</label><input value={bairro} onChange={(ev) => setBairro(ev.target.value)} /></div>
        <div className="field"><label>Cidade</label><input value={cidade} onChange={(ev) => setCidade(ev.target.value)} /></div>
        <div className="field"><label>UF</label><input value={uf} maxLength={2} onChange={(ev) => setUf(ev.target.value.toUpperCase())} /></div>
      </div>
      <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  )
}

// ─────────────────────────── Tab Bancários ───────────────────────────
function TabBancarios({ p }: { p: Colaborador }) {
  const b = p.dadosBancarios ?? {}
  const [editing, setEditing] = useState(false)
  const [banco, setBanco] = useState(b.banco ?? '')
  const [agencia, setAg] = useState(b.agencia ?? '')
  const [conta, setConta] = useState(b.conta ?? '')
  const [tipoConta, setTipoConta] = useState<NonNullable<typeof b.tipoConta> | ''>(b.tipoConta ?? '')
  const [pixTipo, setPixTipo] = useState<NonNullable<typeof b.chavePixTipo> | ''>(b.chavePixTipo ?? '')
  const [pixVal, setPixVal] = useState(b.chavePixValor ?? '')
  const [tipoPag, setTipoPag] = useState<NonNullable<typeof b.tipoPagamento> | ''>(b.tipoPagamento ?? '')
  const [saving, setSaving] = useState(false)

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      await updateDoc(doc(db, 'colaboradores', p.id), {
        dadosBancarios: {
          banco: banco || null, agencia: agencia || null, conta: conta || null,
          tipoConta: tipoConta || null, chavePixTipo: pixTipo || null,
          chavePixValor: pixVal || null, tipoPagamento: tipoPag || null,
        },
        updatedAt: serverTimestamp(),
      })
      setEditing(false)
    } finally { setSaving(false) }
  }

  if (!editing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button className="tbtn pri" onClick={() => setEditing(true)}>✎ Editar dados bancários</button>
        </div>
        <div className="form-grid">
          <Field label="Banco">{b.banco || '—'}</Field>
          <Field label="Agência">{b.agencia || '—'}</Field>
          <Field label="Conta">{b.conta || '—'}</Field>
          <Field label="Tipo de conta">{b.tipoConta ? CONTA_TIPO_LABEL[b.tipoConta] : '—'}</Field>
          <Field label="Chave PIX (tipo)">{b.chavePixTipo ? PIX_TIPO_LABEL[b.chavePixTipo] : '—'}</Field>
          <Field label="Chave PIX (valor)">{b.chavePixValor || '—'}</Field>
          <Field label="Forma de pagamento">{b.tipoPagamento ? TIPO_PAGAMENTO_LABEL[b.tipoPagamento] : '—'}</Field>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={salvar} className="row-gap-14">
      <div className="form-grid">
        <div className="field"><label>Banco</label><input value={banco} onChange={(ev) => setBanco(ev.target.value)} /></div>
        <div className="field"><label>Agência</label><input value={agencia} onChange={(ev) => setAg(ev.target.value)} /></div>
        <div className="field"><label>Conta</label><input value={conta} onChange={(ev) => setConta(ev.target.value)} /></div>
        <div className="field">
          <label>Tipo de conta</label>
          <select value={tipoConta} onChange={(ev) => setTipoConta(ev.target.value as typeof tipoConta)}>
            <option value="">— selecione —</option>
            {Object.entries(CONTA_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Chave PIX (tipo)</label>
          <select value={pixTipo} onChange={(ev) => setPixTipo(ev.target.value as typeof pixTipo)}>
            <option value="">— selecione —</option>
            {Object.entries(PIX_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>Chave PIX (valor)</label><input value={pixVal} onChange={(ev) => setPixVal(ev.target.value)} /></div>
        <div className="field">
          <label>Forma de pagamento</label>
          <select value={tipoPag} onChange={(ev) => setTipoPag(ev.target.value as typeof tipoPag)}>
            <option value="">— selecione —</option>
            {Object.entries(TIPO_PAGAMENTO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  )
}

// ─────────────────────────── Tab Família ───────────────────────────
function TabFamilia({ p }: { p: Colaborador }) {
  const f = p.familia ?? {}
  const [editing, setEditing] = useState(false)
  const [nomePai, setNomePai] = useState(f.nomePai ?? '')
  const [nomeMae, setNomeMae] = useState(f.nomeMae ?? '')
  const [estadoCivil, setEstCivil] = useState<NonNullable<typeof f.estadoCivil> | ''>(f.estadoCivil ?? '')
  const [tipoUniao, setTipoUniao] = useState<NonNullable<typeof f.tipoUniao> | ''>(f.tipoUniao ?? '')
  const [nomeConjuge, setConj] = useState(f.nomeConjuge ?? '')
  const [possuiFilhos, setPF] = useState(f.possuiFilhos ?? false)
  const [filhos, setFilhos] = useState<Filho[]>(f.filhos ?? [])
  const [saving, setSaving] = useState(false)

  function addFilho() {
    setFilhos([...filhos, { id: genId(), nome: '' }])
  }
  function updFilho(idx: number, patch: Partial<Filho>) {
    setFilhos(filhos.map((fi, i) => i === idx ? { ...fi, ...patch } : fi))
  }
  function rmFilho(idx: number) {
    setFilhos(filhos.filter((_, i) => i !== idx))
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      await updateDoc(doc(db, 'colaboradores', p.id), {
        familia: {
          nomePai: nomePai || null, nomeMae: nomeMae || null,
          estadoCivil: estadoCivil || null, tipoUniao: tipoUniao || null,
          nomeConjuge: nomeConjuge || null,
          possuiFilhos,
          filhos: possuiFilhos ? filhos.filter(fi => fi.nome.trim()) : [],
        },
        updatedAt: serverTimestamp(),
      })
      setEditing(false)
    } finally { setSaving(false) }
  }

  if (!editing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button className="tbtn pri" onClick={() => setEditing(true)}>✎ Editar família</button>
        </div>
        <div className="form-grid">
          <Field label="Nome do pai">{f.nomePai || '—'}</Field>
          <Field label="Nome da mãe">{f.nomeMae || '—'}</Field>
          <Field label="Estado civil">{f.estadoCivil ? ESTADO_CIVIL_LABEL[f.estadoCivil] : '—'}</Field>
          <Field label="Regime de bens">{f.tipoUniao ? TIPO_UNIAO_LABEL[f.tipoUniao] : '—'}</Field>
          <Field label="Nome do cônjuge" wide>{f.nomeConjuge || '—'}</Field>
          <Field label="Filhos" wide>
            {!f.possuiFilhos || !f.filhos || f.filhos.length === 0 ? '—' : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {f.filhos.map(fi => (
                  <li key={fi.id} style={{ fontSize: 13 }}>
                    {fi.nome}{fi.dataNascimento ? ` · nascido em ${fmtDate(fi.dataNascimento)}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={salvar} className="row-gap-14">
      <div className="form-grid">
        <div className="field"><label>Nome do pai</label><input value={nomePai} onChange={(e) => setNomePai(e.target.value)} /></div>
        <div className="field"><label>Nome da mãe</label><input value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} /></div>
        <div className="field">
          <label>Estado civil</label>
          <select value={estadoCivil} onChange={(e) => setEstCivil(e.target.value as typeof estadoCivil)}>
            <option value="">— selecione —</option>
            {Object.entries(ESTADO_CIVIL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Regime de bens</label>
          <select value={tipoUniao} onChange={(e) => setTipoUniao(e.target.value as typeof tipoUniao)}>
            <option value="">— selecione —</option>
            {Object.entries(TIPO_UNIAO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Nome do cônjuge</label><input value={nomeConjuge} onChange={(e) => setConj(e.target.value)} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={possuiFilhos} onChange={(e) => setPF(e.target.checked)} /> Possui filhos
          </label>
        </div>
        {possuiFilhos && (
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Filhos</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filhos.map((fi, idx) => (
                <div key={fi.id} className="hstack" style={{ gap: 8 }}>
                  <input
                    style={{ flex: 1 }}
                    placeholder="Nome"
                    value={fi.nome}
                    onChange={(e) => updFilho(idx, { nome: e.target.value })}
                  />
                  <input
                    type="date"
                    value={toDateInput(fi.dataNascimento)}
                    onChange={(e) => updFilho(idx, { dataNascimento: e.target.value ? Timestamp.fromDate(new Date(e.target.value + 'T00:00:00')) : undefined })}
                  />
                  <button type="button" className="tbtn" onClick={() => rmFilho(idx)} style={{ color: 'var(--bad)' }}>✕</button>
                </div>
              ))}
              <button type="button" className="tbtn" onClick={addFilho} style={{ alignSelf: 'flex-start' }}>＋ Adicionar filho</button>
            </div>
          </div>
        )}
      </div>
      <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  )
}

// ───────────────────── Tab Escolaridade & Idiomas ─────────────────────
function TabEscolaridade({ p }: { p: Colaborador }) {
  const [escolaridade, setEsc] = useState<FormacaoEducacional[]>(p.escolaridade ?? [])
  const [idiomas, setIdi] = useState<IdiomaFalado[]>(p.idiomas ?? [])
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'colaboradores', p.id), {
        escolaridade: escolaridade.filter(e => e.curso?.trim() || e.instituicao?.trim()),
        idiomas: idiomas.filter(i => i.idioma.trim()),
        updatedAt: serverTimestamp(),
      })
    } finally { setSaving(false) }
  }

  function addEsc() { setEsc([...escolaridade, { id: genId(), nivel: 'superior_completo' }]) }
  function updEsc(idx: number, patch: Partial<FormacaoEducacional>) {
    setEsc(escolaridade.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }
  function rmEsc(idx: number) { setEsc(escolaridade.filter((_, i) => i !== idx)) }

  function addIdi() { setIdi([...idiomas, { id: genId(), idioma: '', nivel: 'basico' }]) }
  function updIdi(idx: number, patch: Partial<IdiomaFalado>) {
    setIdi(idiomas.map((i, ix) => ix === idx ? { ...i, ...patch } : i))
  }
  function rmIdi(idx: number) { setIdi(idiomas.filter((_, i) => i !== idx)) }

  return (
    <div className="row-gap-14">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Formação acadêmica</h3>
          <button type="button" className="tbtn" onClick={addEsc}>＋ Adicionar formação</button>
        </div>
        {escolaridade.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--mut)' }}>Nenhuma formação cadastrada.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {escolaridade.map((e, idx) => (
              <div key={e.id} className="form-grid" style={{ alignItems: 'end', padding: 10, background: 'var(--card2)', borderRadius: 8 }}>
                <div className="field">
                  <label>Nível</label>
                  <select value={e.nivel} onChange={(ev) => updEsc(idx, { nivel: ev.target.value as FormacaoEducacional['nivel'] })}>
                    {Object.entries(FORMACAO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="field"><label>Curso</label><input value={e.curso ?? ''} onChange={(ev) => updEsc(idx, { curso: ev.target.value })} /></div>
                <div className="field"><label>Instituição</label><input value={e.instituicao ?? ''} onChange={(ev) => updEsc(idx, { instituicao: ev.target.value })} /></div>
                <div className="field"><label>Conclusão (ano)</label><input type="number" value={e.anoConclusao ?? ''} onChange={(ev) => updEsc(idx, { anoConclusao: ev.target.value ? Number(ev.target.value) : undefined })} /></div>
                <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <label style={{ display: 'flex', gap: 6 }}>
                    <input type="checkbox" checked={e.emAndamento ?? false} onChange={(ev) => updEsc(idx, { emAndamento: ev.target.checked })} /> Em andamento
                  </label>
                  <button type="button" className="tbtn" onClick={() => rmEsc(idx)} style={{ color: 'var(--bad)' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Idiomas</h3>
          <button type="button" className="tbtn" onClick={addIdi}>＋ Adicionar idioma</button>
        </div>
        {idiomas.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--mut)' }}>Nenhum idioma cadastrado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {idiomas.map((i, idx) => (
              <div key={i.id} className="hstack" style={{ gap: 8 }}>
                <input style={{ flex: 1 }} placeholder="Ex.: Inglês" value={i.idioma} onChange={(ev) => updIdi(idx, { idioma: ev.target.value })} />
                <select value={i.nivel} onChange={(ev) => updIdi(idx, { nivel: ev.target.value as IdiomaFalado['nivel'] })}>
                  {Object.entries(NIVEL_IDIOMA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button type="button" className="tbtn" onClick={() => rmIdi(idx)} style={{ color: 'var(--bad)' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar formação e idiomas'}</button>
      </div>
    </div>
  )
}

// ─────────────────────────── Tab Documentos ───────────────────────────
function TabDocumentos({ p }: { p: Colaborador }) {
  const { profile } = useAuth()
  const [tipo, setTipo] = useState('RG')
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const docs = p.documentos ?? []

  async function up(file: File) {
    if (!profile) return
    setUploading(true); setErr(null)
    try {
      const r = await uploadFile(file, `prestadores/${p.id}/documentos`)
      const novo: DocumentoDigitalizado = {
        id: genId(),
        tipo,
        nome: r.nome,
        url: r.url,
        path: r.path,
        tamanho: r.tamanho,
        uploadedAt: Timestamp.now(),
        uploadedByUid: profile.uid,
        uploadedByName: profile.name,
      }
      await updateDoc(doc(db, 'colaboradores', p.id), {
        documentos: arrayUnion(novo), updatedAt: serverTimestamp(),
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro no upload.')
    } finally { setUploading(false) }
  }

  async function remover(d: DocumentoDigitalizado) {
    if (!confirm(`Remover documento "${d.nome}" do cadastro?`)) return
    const novos = docs.filter(x => x.id !== d.id)
    await updateDoc(doc(db, 'colaboradores', p.id), {
      documentos: novos, updatedAt: serverTimestamp(),
    })
  }

  return (
    <div className="row-gap-14">
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option>RG</option>
          <option>CPF</option>
          <option>CNPJ</option>
          <option>CNH</option>
          <option>Carteira de Trabalho</option>
          <option>Comprovante de Residência</option>
          <option>Comprovante de Escolaridade</option>
          <option>Contrato</option>
          <option>Currículo</option>
          <option>Outro</option>
        </select>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          {uploading ? 'Enviando…' : '＋ Anexar documento'}
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && up(e.target.files[0])}
            disabled={uploading}
          />
        </label>
      </div>
      {err && <div className="error-text">{err}</div>}

      {docs.length === 0 ? (
        <div className="empty-sub" style={{ padding: 14 }}>Nenhum documento anexado.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Nome</th>
              <th>Enviado por</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...docs].sort((a, b) => (b.uploadedAt?.toMillis?.() ?? 0) - (a.uploadedAt?.toMillis?.() ?? 0)).map(d => (
              <tr key={d.id}>
                <td style={{ fontSize: 12 }}>{d.tipo}</td>
                <td>
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--g600)' }}>{d.nome}</a>
                </td>
                <td style={{ fontSize: 11, color: 'var(--mut)' }}>{d.uploadedByName}</td>
                <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDateTime(d.uploadedAt)}</td>
                <td>
                  <button type="button" className="tbtn" onClick={() => remover(d)} style={{ color: 'var(--bad)', height: 26 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─────────────────────────── Tab Históricos ───────────────────────────
function TabHistoricos({ p }: { p: Colaborador }) {
  const cargos = p.historicoCargo ?? []
  const salarios = p.historicoSalario ?? []

  return (
    <div className="row-gap-14">
      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Movimentações de cargo</h3>
        <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 8 }}>
          Histórico imutável — entradas são registradas automaticamente quando o cargo é alterado na aba Principal.
        </div>
        {cargos.length === 0 ? (
          <div className="empty-sub" style={{ padding: 10 }}>Sem movimentações de cargo registradas.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Data</th><th>Cargo anterior</th><th>Cargo novo</th><th>Motivo</th><th>Registrado por</th></tr>
            </thead>
            <tbody>
              {[...cargos].sort((a, b) => (b.vigenciaEm?.toMillis?.() ?? 0) - (a.vigenciaEm?.toMillis?.() ?? 0)).map(h => (
                <tr key={h.id}>
                  <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDate(h.vigenciaEm)}</td>
                  <td style={{ fontSize: 12 }}>{h.cargoAnterior || '—'}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{h.cargoNovo}</td>
                  <td style={{ fontSize: 12 }}>{h.motivo || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--mut)' }}>{h.registradoPorNome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Movimentações de salário</h3>
        <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 8 }}>
          Histórico imutável — registrado automaticamente ao alterar o salário.
        </div>
        {salarios.length === 0 ? (
          <div className="empty-sub" style={{ padding: 10 }}>Sem movimentações de salário registradas.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Data</th><th>Salário anterior</th><th>Salário novo</th><th>Motivo</th><th>Registrado por</th></tr>
            </thead>
            <tbody>
              {[...salarios].sort((a, b) => (b.vigenciaEm?.toMillis?.() ?? 0) - (a.vigenciaEm?.toMillis?.() ?? 0)).map(h => (
                <tr key={h.id}>
                  <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDate(h.vigenciaEm)}</td>
                  <td style={{ fontSize: 12 }}>{fmtMoney(h.salarioAnterior)}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{fmtMoney(h.salarioNovo)}</td>
                  <td style={{ fontSize: 12 }}>{h.motivo || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--mut)' }}>{h.registradoPorNome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Tab Suspensões ───────────────────────────
function TabSuspensoes({ p }: { p: Colaborador }) {
  const susps = p.suspensoes ?? []
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 10 }}>
        Suspensões temporárias de contrato são solicitadas pelos gestores em <Link to="/gestor/equipe" style={{ color: 'var(--g600)' }}>Meu time</Link>.
      </div>
      {susps.length === 0 ? (
        <div className="empty-sub" style={{ padding: 10 }}>Nenhuma suspensão registrada.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Tipo</th><th>Início</th><th>Fim</th><th>Status</th><th>Solicitante</th><th>Motivo</th></tr>
          </thead>
          <tbody>
            {[...susps].sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0)).map((s: Suspensao) => (
              <tr key={s.id}>
                <td style={{ fontSize: 12 }}>{SUSPENSAO_TIPO_LABEL[s.tipo]}</td>
                <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDate(s.inicio)}</td>
                <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDate(s.fim)}</td>
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
  )
}
