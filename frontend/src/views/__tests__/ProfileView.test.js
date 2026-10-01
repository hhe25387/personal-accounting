import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProfileView from '../ProfileView.vue'
import { setLanguage } from '@/i18n'

describe('ProfileView', () => {
  afterEach(() => {
    setLanguage('en')
    vi.unstubAllGlobals()
  })

  it('切换语言后立即更新界面并保存偏好', async () => {
    const wrapper = mount(ProfileView, {
      global: {
        provide: {
          authContext: {
            user: ref({ name: '小禾', account: 'he@example.com' }),
            logout: vi.fn(),
            updateUser: vi.fn(),
          },
        },
      },
    })

    await wrapper.findAll('.language-options button')[1].trigger('click')

    expect(wrapper.text()).toContain('个人资料')
    expect(wrapper.text()).toContain('修改密码')
    expect(wrapper.text()).toContain('退出登录')
    expect(localStorage.getItem('accounting-language')).toBe('zh')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('展示当前用户资料与账户状态', () => {
    const wrapper = mount(ProfileView, {
      global: {
        provide: {
          authContext: {
            user: ref({ name: '小禾', account: 'he@example.com' }),
            logout: vi.fn(),
          },
        },
      },
    })

    expect(wrapper.text()).toContain('小禾')
    expect(wrapper.text()).toContain('he@example.com')
    expect(wrapper.text()).toContain('Email account')
    expect(wrapper.text()).toContain('Account active')
  })

  it('保存昵称后更新全局用户信息', async () => {
    const updateUser = vi.fn()
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            message: '个人资料已更新',
            user: { name: '新昵称', account: 'he@example.com' },
          }),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ProfileView, {
      global: {
        provide: {
          authContext: {
            user: ref({ name: '小禾', account: 'he@example.com' }),
            logout: vi.fn(),
            updateUser,
          },
        },
      },
    })

    await wrapper.get('#profile-name').setValue('新昵称')
    await wrapper.findAll('form')[0].trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/account/profile',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(updateUser).toHaveBeenCalledWith({
      name: '新昵称',
      account: 'he@example.com',
    })
    expect(wrapper.text()).toContain('Display name saved')
  })

  it('退出前显示确认弹窗，确认后调用统一退出流程', async () => {
    const logout = vi.fn()
    const wrapper = mount(ProfileView, {
      global: {
        provide: {
          authContext: {
            user: ref({ name: '小禾', account: '13800138000' }),
            logout,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Phone account')
    await wrapper.get('.logout-panel button').trigger('click')
    expect(wrapper.text()).toContain('Sign out?')
    expect(logout).not.toHaveBeenCalled()
    await wrapper.get('.danger-button').trigger('click')
    expect(logout).toHaveBeenCalledOnce()
  })

  it('在前端阻止不符合要求的新密码', async () => {
    const wrapper = mount(ProfileView, {
      global: {
        provide: {
          authContext: {
            user: ref({ name: '小禾', account: 'he@example.com' }),
            logout: vi.fn(),
            updateUser: vi.fn(),
          },
        },
      },
    })

    await wrapper.get('#current-password').setValue('abc12345')
    await wrapper.get('#new-password').setValue('short')
    await wrapper.get('#confirm-password').setValue('short')
    await wrapper.findAll('form')[1].trigger('submit')

    expect(wrapper.text()).toContain('New password must be at least 8 characters')
  })
})
