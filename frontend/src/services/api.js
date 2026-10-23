const API_ROOT = '/api'

async function parseResponse(response) {
  const body = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    const validationMessage = body?.errors
      ? Object.values(body.errors).flat().join(' ')
      : null
    const error = new Error(validationMessage || body?.message || 'The request could not be completed.')
    error.status = response.status
    throw error
  }

  return body
}

export async function apiRequest(path, { body, csrfToken, headers = {}, method = 'GET' } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers }
  const isFormData = body instanceof FormData

  if (csrfToken) requestHeaders['X-CSRF-TOKEN'] = csrfToken
  if (body && !isFormData) requestHeaders['Content-Type'] = 'application/json'

  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    credentials: 'same-origin',
    headers: requestHeaders,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })

  return parseResponse(response)
}

export async function getCsrfToken() {
  const result = await apiRequest('/auth/csrf-token')
  return result.csrf_token
}

export async function apiRequestWithCsrf(path, options, currentToken) {
  const csrfToken = currentToken || await getCsrfToken()
  return apiRequest(path, { ...options, csrfToken })
}
