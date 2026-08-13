import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AgentChat from '../AgentChat.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AgentChat', () => {
  it('打开和关闭聊天抽屉', async () => {
    const wrapper = mount(AgentChat)

    expect(wrapper.find('.agent-drawer').exists()).toBe(false)

    await wrapper.get('[data-test="open-agent"]').trigger('click')
    expect(wrapper.get('.agent-drawer').text()).toContain('财务助手')

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
        body: JSON.stringify({ message: '哪个板块花得最多？' }),
      }),
    )
    expect(wrapper.text()).toContain('餐饮是支出最多的分类。')
  })

  it('连接失败时显示友好提示', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(AgentChat)

    await wrapper.get('[data-test="open-agent"]').trigger('click')
    await wrapper.get('#agent-message').setValue('查询余额')
    await wrapper.get('.agent-composer').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('暂时无法连接财务助手')
  })
})
