import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setLanguage } from '@/i18n'
import BudgetView from '../BudgetView.vue'

function response(data, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) })
}

const emptyBudget = {
  month: '2026-08',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  configured: false,
  total: null,
  categories: [],
}

describe('BudgetView', () => {
  beforeEach(() => setLanguage('en'))
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('未设置预算时保持可选空状态并允许开始设置', async () => {
    vi.stubGlobal('fetch', vi.fn((url) =>
      url.includes('/categories')
        ? response([{ id: 1, type: 'expense', name: 'Dining' }])
        : response(emptyBudget),
    ))
    const wrapper = mount(BudgetView)
    await flushPromises()

    expect(wrapper.text()).toContain('No budget, no problem')
    expect(wrapper.text()).toContain('This will not change or block any transaction.')
    await wrapper.get('.budget-primary').trigger('click')
    expect(wrapper.text()).toContain('Create monthly budget')
    expect(wrapper.get('#total-budget').exists()).toBe(true)
  })

  it('保存总预算和分类预算', async () => {
    const savedBudget = {
      ...emptyBudget,
      configured: true,
      total: {
        limit: 1000, spent: 850, remaining: 150, percentage: 85, status: 'warning',
      },
      categories: [
        {
          category: 'Dining', limit: 300, spent: 250, remaining: 50,
          percentage: 83.33, status: 'warning',
        },
      ],
    }
    const fetchMock = vi.fn((url, options = {}) => {
      if (url.includes('/categories')) {
        return response([
          { id: 1, type: 'expense', name: 'Dining' },
          { id: 2, type: 'expense', name: 'Shopping' },
        ])
      }
      if (options.method === 'PUT') return response({ message: 'Budget saved', budget: savedBudget })
      return response(emptyBudget)
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(BudgetView)
    await flushPromises()

    await wrapper.get('.budget-primary').trigger('click')
    await wrapper.get('#total-budget').setValue('1000')
    await wrapper.get('.add-category-budget').trigger('click')
    await wrapper.get('.category-budget-row input').setValue('300')
    await wrapper.get('.budget-editor-actions .budget-primary').trigger('click')
    await flushPromises()

    const saveCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')
    expect(saveCall[0]).toContain('/api/budgets/')
    expect(JSON.parse(saveCall[1].body)).toEqual({
      totalAmount: 1000,
      categories: [{ category: 'Dining', amount: 300 }],
    })
    expect(wrapper.text()).toContain('Approaching limit')
    expect(wrapper.text()).toContain('¥850.00')
    expect(wrapper.text()).toContain('Dining')
  })

  it('展示正常、提醒和超支状态并支持中文', async () => {
    setLanguage('zh')
    const configuredBudget = {
      ...emptyBudget,
      configured: true,
      total: {
        limit: 1000, spent: 1100, remaining: -100, percentage: 110, status: 'exceeded',
      },
      categories: [
        {
          category: 'Dining', limit: 300, spent: 120, remaining: 180,
          percentage: 40, status: 'safe',
        },
      ],
    }
    vi.stubGlobal('fetch', vi.fn((url) =>
      url.includes('/categories')
        ? response([{ id: 1, type: 'expense', name: 'Dining' }])
        : response(configuredBudget),
    ))
    const wrapper = mount(BudgetView)
    await flushPromises()

    expect(wrapper.text()).toContain('预算进度')
    expect(wrapper.text()).toContain('已超支')
    expect(wrapper.text()).toContain('餐饮')
    expect(wrapper.text()).toContain('进度正常')
  })
})
