import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RecordsView from '../RecordsView.vue'

function response(data) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
}

describe('RecordsView', () => {
  beforeEach(() => {
    const NativeDate = Date
    vi.stubGlobal('Date', class extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : ['2026-08-14T12:00:00']))
      }

      static now() {
        return new NativeDate('2026-08-14T12:00:00').getTime()
      }
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('在独立页面读取并展示账目', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url) =>
        url.includes('/categories')
          ? response([{ id: 1, type: 'expense', name: '餐饮' }])
          : response([
              {
                id: 1,
                type: 'expense',
                amount: 36,
                category: '餐饮',
                transactionDate: '2026-08-14',
                description: '午餐',
              },
            ]),
      ),
    )

    const wrapper = mount(RecordsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Every transaction, all in one place')
    expect(wrapper.text()).toContain('餐饮')
    expect(wrapper.text()).toContain('午餐')
    expect(wrapper.find('.transaction-form').exists()).toBe(false)
  })

  it('点击编辑后才显示编辑弹层', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url) =>
        url.includes('/categories')
          ? response([{ id: 1, type: 'expense', name: '购物' }])
          : response([
              {
                id: 2,
                type: 'expense',
                amount: 100,
                category: '购物',
                transactionDate: '2026-08-14',
                description: '',
              },
            ]),
      ),
    )
    const wrapper = mount(RecordsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()
    await wrapper.get('[data-test="edit-transaction"]').trigger('click')

    expect(wrapper.find('.records-edit-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Edit Entry')
  })

  it('组合收支类型、分类和月份请求后端筛选账目', async () => {
    const fetchMock = vi.fn((url) =>
      url.includes('/categories')
        ? response([
            { id: 1, type: 'expense', name: '餐饮' },
            { id: 2, type: 'income', name: '工资' },
          ])
        : response([
            {
              id: 3,
              type: 'expense',
              amount: 28,
              category: '餐饮',
              transactionDate: '2026-08-14',
              description: '晚餐',
            },
            {
              id: 4,
              type: 'income',
              amount: 5000,
              category: '工资',
              transactionDate: '2026-08-14',
              description: '本月工资',
            },
            {
              id: 5,
              type: 'expense',
              amount: 100,
              category: '购物',
              transactionDate: '2026-08-20',
              description: '日用品',
            },
          ]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(RecordsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()
    fetchMock.mockClear()

    await wrapper.get('input[value="expense"]').setValue()
    await wrapper.get('#filter-category').setValue('餐饮')
    await wrapper.get('#filter-date-mode').setValue('month')
    await wrapper.get('#filter-month').setValue('2026-08')
    await new Promise((resolve) => window.setTimeout(resolve, 150))
    await flushPromises()

    const requestUrl = new URL(fetchMock.mock.calls[0][0])
    expect(requestUrl.searchParams.get('type')).toBe('expense')
    expect(requestUrl.searchParams.get('category')).toBe('餐饮')
    expect(requestUrl.searchParams.get('startDate')).toBe('2026-08-01')
    expect(requestUrl.searchParams.get('endDate')).toBe('2026-08-31')
    expect(wrapper.text()).toContain('3 filters applied')
    expect(wrapper.text()).toContain('1 transactions found')
    expect(wrapper.text()).not.toContain('本月工资')
    expect(wrapper.text()).not.toContain('日用品')
    wrapper.unmount()
  })

  it('阻止开始日期晚于结束日期的筛选', async () => {
    const fetchMock = vi.fn((url) =>
      url.includes('/categories') ? response([]) : response([]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(RecordsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()
    fetchMock.mockClear()

    await wrapper.get('#filter-date-mode').setValue('range')
    await wrapper.get('#filter-start-date').setValue('2026-08-20')
    await wrapper.get('#filter-end-date').setValue('2026-08-01')
    await new Promise((resolve) => window.setTimeout(resolve, 150))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('The start date cannot be after the end date')
    wrapper.unmount()
  })

  it('切换金额排序后自动请求并按金额排列结果', async () => {
    const fetchMock = vi.fn((url) =>
      url.includes('/categories')
        ? response([])
        : response([
          {
            id: 1,
            type: 'expense',
            amount: 12,
            category: '餐饮',
            transactionDate: '2026-08-14',
            description: '',
          },
            {
              id: 2,
              type: 'expense',
              amount: 88,
              category: '购物',
              transactionDate: '2026-08-13',
              description: '',
            },
          ]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(RecordsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()
    fetchMock.mockClear()

    await wrapper.get('#filter-sort').setValue('amount_desc')
    await new Promise((resolve) => window.setTimeout(resolve, 150))
    await flushPromises()

    const requestUrl = new URL(fetchMock.mock.calls[0][0])
    expect(requestUrl.searchParams.get('sortBy')).toBe('amount')
    expect(requestUrl.searchParams.get('sortOrder')).toBe('desc')
    const rows = wrapper.findAll('[data-test="transaction-row"]')
    expect(rows[0].text()).toContain('¥88.00')
    expect(rows[1].text()).toContain('¥12.00')
    wrapper.unmount()
  })

  it('旧后端不认识排序参数时自动回退到前端排序', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/categories')) return response([])
      if (url.includes('sortBy=')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Unsupported filter: sortBy' }),
        })
      }
      return response([
        {
          id: 1,
          type: 'expense',
          amount: 10,
          category: '餐饮',
          transactionDate: '2026-08-14',
          description: '',
        },
      ])
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(RecordsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()

    const transactionRequests = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes('/transactions'))
    expect(transactionRequests).toHaveLength(2)
    expect(transactionRequests[0]).toContain('sortBy=date')
    expect(transactionRequests[1]).not.toContain('sortBy=')
    expect(wrapper.text()).toContain('餐饮')
    wrapper.unmount()
  })

  it('按分类或备注关键词搜索并过滤后端返回结果', async () => {
    const fetchMock = vi.fn((url) =>
      url.includes('/categories')
        ? response([])
        : response([
            {
              id: 1,
              type: 'expense',
              amount: 50,
              category: '餐饮',
              transactionDate: '2026-08-10',
              description: '和朋友聚餐',
            },
            {
              id: 2,
              type: 'expense',
              amount: 20,
              category: '交通',
              transactionDate: '2026-08-11',
              description: '地铁',
            },
          ]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(RecordsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()
    fetchMock.mockClear()

    await wrapper.get('#filter-keyword').setValue('朋友')
    await new Promise((resolve) => window.setTimeout(resolve, 150))
    await flushPromises()

    const requestUrl = new URL(fetchMock.mock.calls[0][0])
    expect(requestUrl.searchParams.get('keyword')).toBe('朋友')
    expect(wrapper.text()).toContain('和朋友聚餐')
    expect(wrapper.text()).not.toContain('地铁')
    expect(wrapper.text()).toContain('1 filters applied')
    wrapper.unmount()
  })

  it('账目超过 25 笔时分批Load more', async () => {
    const allTransactions = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      type: 'expense',
      amount: index + 1,
      category: '餐饮',
      transactionDate: '2026-08-14',
      description: `第 ${index + 1} 笔`,
    }))
    const fetchMock = vi.fn((url) => {
      if (url.includes('/categories')) return response([])
      const requestUrl = new URL(url)
      const offset = Number(requestUrl.searchParams.get('offset'))
      const page = allTransactions.slice(offset, offset + 25)
      return response({
        transactions: page,
        pagination: {
          total: 30,
          limit: 25,
          offset,
          hasMore: offset + page.length < 30,
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(RecordsView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()

    expect(wrapper.findAll('[data-test="transaction-row"]')).toHaveLength(25)
    expect(wrapper.text()).toContain('Showing 25 of 30')
    await wrapper.get('.load-more-button').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-test="transaction-row"]')).toHaveLength(30)
    expect(wrapper.find('.load-more-button').exists()).toBe(false)
    wrapper.unmount()
  })
})
