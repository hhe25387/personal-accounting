import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TransactionForm from '../TransactionForm.vue'

const categories = [
  { id: 1, type: 'income', name: '工资', isDefault: true },
  { id: 2, type: 'expense', name: '餐饮', isDefault: true },
]

describe('TransactionForm', () => {
  it('默认进入支出模式并可以直接看到完整表单', () => {
    const wrapper = mount(TransactionForm, { props: { categories } })

    expect(wrapper.get('[data-test="expense-button"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(wrapper.get('#amount').exists()).toBe(true)
    expect(wrapper.get('#transaction-date').element.value).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
  })

  it('切换收入和支出时保留金额日期备注并记住各自分类', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories: [
          ...categories,
          { id: 3, type: 'expense', name: '交通', isDefault: true },
          { id: 4, type: 'income', name: '奖金', isDefault: true },
        ],
      },
    })

    await wrapper.get('#amount').setValue('88')
    await wrapper.get('#description').setValue('保留这条备注')
    await wrapper.get('#category').setValue('交通')
    await wrapper.get('[data-test="income-button"]').trigger('click')
    await wrapper.get('#category').setValue('奖金')

    expect(wrapper.get('#amount').element.value).toBe('88')
    expect(wrapper.get('#description').element.value).toBe('保留这条备注')

    await wrapper.get('[data-test="expense-button"]').trigger('click')
    expect(wrapper.get('#category').element.value).toBe('交通')

    await wrapper.get('[data-test="income-button"]').trigger('click')
    expect(wrapper.get('#category').element.value).toBe('奖金')
  })

  it('保存成功后清空金额和备注但保留当前类型与分类', async () => {
    const wrapper = mount(TransactionForm, { props: { categories } })

    await wrapper.get('#amount').setValue('36.5')
    await wrapper.get('#description').setValue('晚餐')
    await wrapper.get('#category').setValue('餐饮')
    await wrapper.setProps({ savedRevision: 1 })

    expect(wrapper.get('#amount').element.value).toBe('')
    expect(wrapper.get('#description').element.value).toBe('')
    expect(wrapper.get('#category').element.value).toBe('餐饮')
    expect(wrapper.get('[data-test="expense-button"]').attributes('aria-pressed')).toBe(
      'true',
    )
  })

  it('接收 AA 计算器金额并自动切换到支出', async () => {
    const wrapper = mount(TransactionForm, { props: { categories } })

    await wrapper.get('[data-test="income-button"]').trigger('click')
    await wrapper.setProps({ prefillAmount: 33.33, prefillRevision: 1 })

    expect(wrapper.get('#amount').element.value).toBe('33.33')
    expect(wrapper.get('[data-test="expense-button"]').attributes('aria-pressed')).toBe(
      'true',
    )
  })

  it('点击常用模板后预填类型、金额、分类和备注但不自动提交', async () => {
    const wrapper = mount(TransactionForm, { props: { categories } })

    await wrapper.setProps({
      prefillTemplate: {
        id: 8,
        name: '每月工资',
        type: 'income',
        amount: 5000,
        category: '工资',
        description: '固定工资',
      },
      prefillTemplateRevision: 1,
    })

    expect(wrapper.get('[data-test="income-button"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('#amount').element.value).toBe('5000')
    expect(wrapper.get('#category').element.value).toBe('工资')
    expect(wrapper.get('#description').element.value).toBe('固定工资')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('金额留空的模板只预填场景内容', async () => {
    const wrapper = mount(TransactionForm, { props: { categories } })

    await wrapper.setProps({
      prefillTemplate: {
        id: 9,
        name: '外出吃饭',
        type: 'expense',
        amount: null,
        category: '餐饮',
        description: '',
      },
      prefillTemplateRevision: 1,
    })

    expect(wrapper.get('#amount').element.value).toBe('')
    expect(wrapper.get('#category').element.value).toBe('餐饮')
  })

  it('提交完整的支出账目', async () => {
    const wrapper = mount(TransactionForm, {
      props: { categories },
    })

    await wrapper.get('[data-test="expense-button"]').trigger('click')
    await wrapper.get('#amount').setValue('18.75')
    await wrapper.get('#category').setValue('餐饮')
    await wrapper.get('#transaction-date').setValue('2026-08-10')
    await wrapper.get('#description').setValue('午餐')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')[0][0]).toEqual({
      type: 'expense',
      amount: 18.75,
      category: '餐饮',
      transactionDate: '2026-08-10',
      description: '午餐',
    })
  })

  it('输入支出时实时预览总预算和分类预算的记账后进度', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories,
        budget: {
          configured: true,
          total: { limit: 1000, spent: 700 },
          categories: [{ category: '餐饮', limit: 300, spent: 220 }],
        },
      },
    })

    await wrapper.get('#amount').setValue('50')

    const rows = wrapper.findAll('.budget-impact-row')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('Estimated budget impact')
    expect(rows[0].text()).toContain('75%')
    expect(rows[1].attributes('data-status')).toBe('warning')
    expect(rows[1].text()).toContain('90%')
  })

  it('没有预算或切换到收入时不显示预算影响', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories,
        budget: {
          configured: true,
          total: { limit: 1000, spent: 700 },
          categories: [],
        },
      },
    })

    await wrapper.get('#amount').setValue('50')
    expect(wrapper.find('.budget-impact').exists()).toBe(true)

    await wrapper.get('[data-test="income-button"]').trigger('click')
    expect(wrapper.find('.budget-impact').exists()).toBe(false)

    await wrapper.setProps({ budget: { configured: false, total: null, categories: [] } })
    await wrapper.get('[data-test="expense-button"]').trigger('click')
    expect(wrapper.find('.budget-impact').exists()).toBe(false)
  })

  it('自动填入并提交修改后的账目', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories: [
          ...categories,
          { id: 3, type: 'expense', name: '交通', isDefault: true },
        ],
        editingTransaction: {
          id: 3,
          type: 'income',
          amount: 500,
          category: '工资',
          transactionDate: '2026-08-11',
          description: '八月工资',
        },
      },
    })

    expect(wrapper.get('h2').text()).toBe('Edit Entry')
    expect(wrapper.get('#amount').element.value).toBe('500')
    expect(wrapper.get('#category').element.value).toBe('工资')
    expect(wrapper.get('#transaction-date').element.value).toBe(
      '2026-08-11',
    )
    expect(wrapper.get('#description').element.value).toBe('八月工资')

    await wrapper.get('#amount').setValue('550')
    await wrapper.get('#description').setValue('调整后的工资')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')[0][0]).toEqual({
      type: 'income',
      amount: 550,
      category: '工资',
      transactionDate: '2026-08-11',
      description: '调整后的工资',
    })
  })

  it('Cancel editing时通知父组件', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories,
        editingTransaction: {
          id: 3,
          type: 'income',
          amount: 500,
          category: '工资',
          transactionDate: '2026-08-11',
          description: '',
        },
      },
    })

    const cancelButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Cancel editing')

    await cancelButton.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('根据当前账目类型显示后端分类', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories: [
          ...categories,
          { id: 3, type: 'income', name: '奖学金', isDefault: false },
          { id: 4, type: 'expense', name: '宠物', isDefault: false },
        ],
      },
    })

    await wrapper.get('[data-test="expense-button"]').trigger('click')

    const optionTexts = wrapper
      .findAll('#category option')
      .map((option) => option.text())

    expect(optionTexts).toContain('餐饮')
    expect(optionTexts).toContain('宠物')
    expect(optionTexts).not.toContain('工资')
    expect(optionTexts).not.toContain('奖学金')
  })

  it('分类加载失败时禁用选择框并显示提示', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories: [],
        categoriesError: '分类加载失败，请确认后端已经启动',
      },
    })

    await wrapper.get('[data-test="expense-button"]').trigger('click')

    expect(wrapper.get('#category').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('分类加载失败')
  })

  it('接口失败时仍可显示并选择前端提供的默认分类', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories: [
          ...categories,
          { id: 3, type: 'expense', name: '交通', isDefault: true },
        ],
        categoriesError: '正在使用默认分类；启动后端后即可保存账目',
      },
    })

    expect(wrapper.get('.category-chip').text()).toBe('餐饮')
    await wrapper.findAll('.category-chip')[1].trigger('click')
    expect(wrapper.findAll('.category-chip')[1].classes()).toContain('is-selected')
  })

  it('提交当前类型的Custom分类名称', async () => {
    const wrapper = mount(TransactionForm, {
      props: { categories },
    })

    await wrapper.get('[data-test="expense-button"]').trigger('click')
    await wrapper.get('[data-test="open-category-creator"]').trigger('click')
    await wrapper.get('#new-category-name').setValue('  宠物  ')
    await wrapper.get('[data-test="create-category"]').trigger('click')

    expect(wrapper.emitted('create-category')).toEqual([
      [{ type: 'expense', name: '宠物' }],
    ])
  })

  it('新分类加入列表后自动选中并收起输入区域', async () => {
    const wrapper = mount(TransactionForm, {
      props: { categories },
    })

    await wrapper.get('[data-test="expense-button"]').trigger('click')
    await wrapper.get('[data-test="open-category-creator"]').trigger('click')
    await wrapper.get('#new-category-name').setValue('宠物')
    await wrapper.get('[data-test="create-category"]').trigger('click')
    await wrapper.setProps({
      categories: [
        ...categories,
        { id: 3, type: 'expense', name: '宠物', isDefault: false },
      ],
    })

    expect(wrapper.get('#category').element.value).toBe('宠物')
    expect(wrapper.find('.category-creator').exists()).toBe(false)
  })

  it('显示新增分类接口返回的错误', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
        categories,
        categoryCreateError: '这个分类已经存在',
      },
    })

    await wrapper.get('[data-test="expense-button"]').trigger('click')
    await wrapper.get('[data-test="open-category-creator"]').trigger('click')

    expect(wrapper.get('.category-creator [role="alert"]').text()).toBe(
      '这个分类已经存在',
    )
  })

  it('打开和Cancel新增区域时通知父组件清除旧错误', async () => {
    const wrapper = mount(TransactionForm, {
      props: { categories },
    })

    await wrapper.get('[data-test="expense-button"]').trigger('click')
    await wrapper.get('[data-test="open-category-creator"]').trigger('click')
    await wrapper
      .findAll('.category-creator button')
      .find((button) => button.text() === 'Cancel')
      .trigger('click')

    expect(wrapper.emitted('clear-category-error')).toHaveLength(2)
  })
})
