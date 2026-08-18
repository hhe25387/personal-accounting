import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AgentChat from '../AgentChat.vue'
import { setLanguage } from '@/i18n'

beforeEach(() => setLanguage('en'))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AgentChat', () => {
  it('打开和关闭聊天抽屉', async () => {
    const wrapper = mount(AgentChat)

    expect(wrapper.find('.agent-drawer').exists()).toBe(false)

    await wrapper.get('[data-test="open-agent"]').trigger('click')
    expect(wrapper.get('.agent-drawer').text()).toContain('Financial Assistant')

    await wrapper.get('[data-test="close-agent"]').trigger('click')
    expect(wrapper.find('.agent-drawer').exists()).toBe(false)
  })

  it('发送问题并显示 Agent 回答', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      async json() {
        return {
          answer: '餐饮是支出最多的分类。',
          toolCall: { name: 'get_category_breakdown', input: {} },
          grounding: {
            source: 'get_category_breakdown',
            readOnly: true,
            evidenceCount: 3,
          },
        }
      },
    })
    const wrapper = mount(AgentChat)

    await wrapper.get('[data-test="open-agent"]').trigger('click')
    await wrapper.get('#agent-message').setValue('哪个板块花得最多？')
    await wrapper.get('.agent-composer').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/assistant',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          message: '哪个板块花得最多？',
          language: 'en',
        }),
      }),
    )
    expect(wrapper.text()).toContain('餐饮是支出最多的分类。')
    expect(wrapper.text()).toContain('Verified from your ledger')
    expect(wrapper.text()).toContain('Read-only analysis')
  })

  it('将当前界面语言传给助手并显示中文来源说明', async () => {
    setLanguage('zh')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      async json() {
        return {
          answer: '本月共有 2 笔账目。',
          grounding: { readOnly: true, evidenceCount: 2 },
        }
      },
    })
    const wrapper = mount(AgentChat)

    await wrapper.get('[data-test="open-agent"]').trigger('click')
    await wrapper.get('#agent-message').setValue('总结本月')
    await wrapper.get('.agent-composer').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/assistant',
      expect.objectContaining({
        body: JSON.stringify({ message: '总结本月', language: 'zh' }),
      }),
    )
    expect(wrapper.text()).toContain('已根据账本核对')
    expect(wrapper.text()).toContain('只读分析')
  })

  it('连接失败时显示友好提示', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(AgentChat)

    await wrapper.get('[data-test="open-agent"]').trigger('click')
    await wrapper.get('#agent-message').setValue('查询余额')
    await wrapper.get('.agent-composer').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Cannot connect to the financial assistant')
  })
})
