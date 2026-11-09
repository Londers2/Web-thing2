export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api${url}`, { ...options, headers, credentials: 'same-origin' })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith('/auth/login')) window.dispatchEvent(new Event('auth:unauthorized'))
    throw new ApiError(response.status, data.error || 'Не удалось выполнить запрос')
  }
  return data as T
}

export const jsonBody = (value: unknown) => JSON.stringify(value)
