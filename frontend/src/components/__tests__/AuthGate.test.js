import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import AuthGate from '../AuthGate.vue'
import { setLanguage } from '@/i18n'

describe('AuthGate', () => {
  beforeEach(() => {
    localStorage.clear()
    setLanguage('en')
  })

  it('可以在登录前切换为中文', async () => {
    const wrapper = mount(AuthGate)

    await wrapper.findAll('.auth-language-switch button')[1].trigger('click')

    expect(wrapper.text()).toContain('欢迎回来')
    expect(wrapper.text()).toContain('忘记密码？')
    expect(wrapper.text()).toContain('你的账户将由本地服务器安全验证。')
    expect(localStorage.getItem('accounting-language')).toBe('zh')
  })

  it('可以从登录切换到注册和Recover your password', async () => {
    const wrapper = mount(AuthGate)

    expect(wrapper.text()).toContain('Welcome back')

    await wrapper.get('.auth-footer .text-button').trigger('click')
    expect(wrapper.text()).toContain('Create your ledger')

    await wrapper.get('.auth-footer .text-button').trigger('click')
    await wrapper.findAll('.text-button')[0].trigger('click')
    expect(wrapper.text()).toContain('Recover your password')
  })

  it('空登录表单给出明确错误且不会通过认证', async () => {
    const wrapper = mount(AuthGate)

    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('Enter your email or phone number')
    expect(wrapper.text()).toContain('Enter your password')
    expect(wrapper.emitted('authenticated')).toBeUndefined()
  })
})
