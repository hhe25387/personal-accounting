import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QuickTools from '../QuickTools.vue'

const categories = [
  { id: 1, type: 'expense', name: '餐饮' },
  { id: 2, type: 'income', name: '工资' },
]

const templates = [{
  id: 1,
  name: '工作午餐',
  type: 'expense',
  amount: 32,
  category: '餐饮',
  description: '',
  isPinned: true,
}]

function mountTools() {
  return mount(QuickTools, {
    attachTo: document.body,
    props: { templates, categories },
    global: { stubs: { Teleport: true } },
  })
}

describe('QuickTools', () => {
  it('模板按钮打开弹层，套用后转发数据并自动关闭', async () => {
    const wrapper = mountTools()

    await wrapper.get('[data-test="open-templates"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').isVisible()).toBe(true)

    await wrapper.get('.quick-template-chip').trigger('click')
    expect(wrapper.emitted('use-template')).toEqual([[templates[0]]])
    expect(wrapper.get('[role="dialog"]').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('计算结果填入后自动关闭，重新打开仍保留上次输入', async () => {
    const wrapper = mountTools()

    await wrapper.get('[data-test="open-calculator"]').trigger('click')
    await wrapper.get('#split-total').setValue('120')
    await wrapper.get('#split-people').setValue('3')
    await wrapper.findAll('.calculator-actions button')[0].trigger('click')

    expect(wrapper.emitted('use-amount')).toEqual([[{ amount: 40, source: 'share' }]])
    expect(wrapper.get('[role="dialog"]').isVisible()).toBe(false)

    await wrapper.get('[data-test="open-calculator"]').trigger('click')
    expect(wrapper.get('#split-total').element.value).toBe('120')
    expect(wrapper.get('#split-people').element.value).toBe('3')
    wrapper.unmount()
  })

  it('支持快捷键，但用户正在输入时不会误打开工具', async () => {
    const wrapper = mountTools()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', altKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="dialog"]').isVisible()).toBe(true)
    await wrapper.get('.quick-tool-close').trigger('click')

    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', altKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="dialog"]').isVisible()).toBe(false)

    input.remove()
    wrapper.unmount()
  })
})
