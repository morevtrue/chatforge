/**
 * Хелпер для построения путей чат-страниц.
 * На субдомене (test.localhost) пути без /chat префикса: /login, /chat, /chat/:id
 * На основном домене (localhost) пути с /chat префиксом: /chat/login, /chat, /chat/:id
 * Dev-fallback: если subdomain передан через ?subdomain=, сохраняем его в путях
 */

function isSubdomain(): boolean {
  const host = window.location.hostname
  const parts = host.split('.')
  if (parts.length === 2 && parts[1] === 'localhost') return true
  if (parts.length === 3 && parts[1] === 'chatforge' && parts[2] === 'app') return true
  // Dev-fallback: ?subdomain=xxx в URL
  const params = new URLSearchParams(window.location.search)
  if (params.get('subdomain')) return true
  return false
}

/** Возвращает ?subdomain=xxx если используется dev-fallback, иначе '' */
function subdomainParam(): string {
  const host = window.location.hostname
  const parts = host.split('.')
  // Настоящий субдомен — param не нужен
  if (parts.length === 2 && parts[1] === 'localhost') return ''
  if (parts.length === 3 && parts[1] === 'chatforge' && parts[2] === 'app') return ''
  // Dev-fallback через query param
  const params = new URLSearchParams(window.location.search)
  const sub = params.get('subdomain')
  return sub ? `?subdomain=${sub}` : ''
}

export const chatRoutes = {
  login: () => isSubdomain() ? `/login${subdomainParam()}` : '/chat/login',
  register: () => isSubdomain() ? `/register${subdomainParam()}` : '/chat/register',
  chat: () => `/chat${subdomainParam()}`,
  conversation: (id: string) => `/chat/${id}${subdomainParam()}`,
  subscriptionSuccess: () => isSubdomain() ? `/subscription/success${subdomainParam()}` : '/chat/subscription/success',
  subscriptionCancel: () => isSubdomain() ? `/subscription/cancel${subdomainParam()}` : '/chat/subscription/cancel',
}
