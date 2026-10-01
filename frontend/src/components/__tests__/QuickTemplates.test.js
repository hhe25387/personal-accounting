import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QuickTemplates from '../QuickTemplates.vue'

const categories = [
  { id: 1, type: 'expense', name: '餐饮' },
  { id: 2, type: 'expense', name: '交通' },
  { id: 3, type: 'income', name: '工资' },
]

const templates = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  name: `模板${index + 1}`,
  type: 'expense',
  amount: index === 0 ? 28 : null,
  category: '餐饮',
  description: '',
  isPinned: index === 0,
  useCount: 0,
}))

function mountTemplates(props = {}) {
  return mount(QuickTemplates, {
    props: { templates, categories, ...props },
    global: { stubs: { Teleport: true } },
  })
}

describe('QuickTemplates', () => {
  it('主页最多展示四个模板和新建入口', async () => {
    const wrapper = mountTemplates()
    const templateButtons = wrapper.findAll('.quick-template-chip:not(.quick-template-chip--add)')

    expect(templateButtons).toHaveLength(4)
    expect(wrapper.text()).toContain('模板1')
    expect(wrapper.text()).not.toContain('模板5')

    await templateButtons[0].trigger('click')
    expect(wrapper.emitted('use')[0][0].id).toBe(1)
  })

  it('新建模板时提交预填所需字段且金额允许留空', async () => {
    const wrapper = mountTemplates({ templates: [] })

    await wrapper.get('.quick-template-chip--add').trigger('click')
    await wrapper.get('.template-add-button').trigger('click')
    await wrapper.get('.template-editor input[type="text"]').setValue('工作午餐')
    await wrapper.get('.template-editor').trigger('submit')

    expect(wrapper.emitted('create')[0][0]).toEqual({
      payload: {
        name: '工作午餐',
        type: 'expense',
        amount: '',
        category: '餐饮',
        description: '',
        isPinned: false,
      },
    })
  })

  it('管理弹层中可以把刚保存的账目转成模板草稿', async () => {
    const wrapper = mountTemplates({
      lastTransaction: {
        type: 'expense',
        amount: 42,
        category: '交通',
        description: '机场打车',
      },
    })

    await wrapper.get('.text-button').trigger('click')
    await wrapper.get('.save-last-template').trigger('click')

    const inputs = wrapper.findAll('.template-editor input[type="text"]')
    expect(inputs[0].element.value).toBe('机场打车')
    expect(wrapper.get('.template-editor input[type="number"]').element.value).toBe('42')
    expect(wrapper.findAll('.template-editor select')[1].element.value).toBe('交通')
  })
})
