const DEFAULT_API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000'

export const SESSION_EXPIRED_EVENT = 'accounting:session-expired'

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function apiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function apiRequest(path, options = {}) {
  const {
    body,
    fallbackMessage = 'Request failed',
    headers: customHeaders,
    notifyUnauthorized = true,
    ...fetchOptions
  } = options
  const headers = new Headers(customHeaders)
  const requestBody = body === undefined ? undefined : JSON.stringify(body)

  if (requestBody !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: 'include',
    ...fetchOptions,
    headers,
    body: requestBody,
  })
  const data = await readJson(response)

  if (!response.ok) {
    if (response.status === 401 && notifyUnauthorized) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }
    throw new ApiError(data?.message || fallbackMessage, {
      status: response.status,
      data,
    })
  }

  return data
}
