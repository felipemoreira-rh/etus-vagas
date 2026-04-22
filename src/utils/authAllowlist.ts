// Domínios de e-mail corporativo aceitos pra autenticação via Google e
// pro cadastro self-service em /signup. Admins (RH) ainda podem criar contas
// com qualquer domínio via o botão "+ Novo usuário" em Usuários — essa lista
// se aplica apenas aos fluxos de autoatendimento (Google sign-in + signup).
export const ALLOWED_DOMAIN_PREFIXES = ['etus.', 'plusdin.', 'brius.', 'bhaz.']

export function getDomain(email: string): string {
  const at = email.lastIndexOf('@')
  if (at === -1) return ''
  return email.slice(at + 1).toLowerCase()
}

export function isEmailAllowed(email: string): boolean {
  const domain = getDomain(email)
  if (!domain) return false
  return ALLOWED_DOMAIN_PREFIXES.some((p) => domain.startsWith(p))
}

export function allowedDomainsHuman(): string {
  // Render "@etus, @plusdin, @brius e @bhaz" pra mensagens de erro.
  const parts = ALLOWED_DOMAIN_PREFIXES.map((p) => '@' + p.replace(/\.$/, ''))
  if (parts.length <= 1) return parts.join('')
  return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1]
}
