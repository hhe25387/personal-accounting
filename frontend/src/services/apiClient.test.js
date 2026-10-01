import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiError,
  apiRequest,
  SESSION_EXPIRED_EVENT,
} from './apiClient'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('apiRequest', () => {
  it('统一添加 API 地址、Cookie 和 JSON 请求体', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ saved: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/example', {
      method: 'POST',
      body: { amount: 12 },
    })).resolves.toEqual({ saved: true })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/example',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ amount: 12 }),
      }),
    )
    expect(fetchMock.mock.calls[0][1].headers.get('Content-Type')).toBe(
      'application/json',
    )
  })

  it('保留后端状态码和错误内容', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid amount', field: 'amount' }),
    }))

    const error = await apiRequest('/api/transactions').catch((failure) => failure)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe('Invalid amount')
    expect(error.status).toBe(400)
    expect(error.data.field).toBe('amount')
  })

  it('受保护接口返回 401 时通知应用清除过期会话', async () => {
    const listener = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, listener, { once: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Authentication required' }),
    }))

    await expect(apiRequest('/api/transactions')).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('登录失败不会被误判为已有会话过期', async () => {
    const listener = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, listener, { once: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Incorrect password' }),
    }))

    await expect(apiRequest('/api/auth/login', {
      method: 'POST',
      body: {},
      notifyUnauthorized: false,
    })).rejects.toThrow('Incorrect password')
    expect(listener).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
  })
})
