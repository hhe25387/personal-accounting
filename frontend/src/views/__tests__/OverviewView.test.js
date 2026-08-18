import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import OverviewView from '../OverviewView.vue'

function response(data) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
}

describe('OverviewView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('读取并展示真实月度汇总、每日趋势和分类占比', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/summary')) {
        return response({
          month: '2026-08',
          totalIncome: 12000,
          totalExpense: 4286,
          balance: 7714,
          transactionCount: 5,
        })
      }
      if (url.includes('/daily')) {
        return response({
          month: '2026-08',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          days: [
            {
              date: '2026-08-13',
              income: 12000,
              expense: 36.5,
              transactionCount: 2,
            },
          ],
        })
      }
      return response({
        month: '2026-08',
        type: 'expense',
        categories: [
          {
            category: '餐饮',
            amount: 4286,
            transactionCount: 3,
            percentage: 100,
          },
        ],
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(OverviewView)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('¥12,000.00')
    expect(wrapper.text()).toContain('餐饮')
    expect(wrapper.text()).toContain('3 entries · 100%')
    expect(wrapper.findAll('.daily-column')).toHaveLength(31)
  })

  it('切换月份后重新读取三组统计数据', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/summary')) {
        return response({
          month: '2026-07',
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
          transactionCount: 0,
        })
      }
      if (url.includes('/daily')) {
        return response({
          month: '2026-07',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          days: [],
        })
      }
      return response({ month: '2026-07', type: 'expense', categories: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(OverviewView)
    await flushPromises()
    fetchMock.mockClear()

    await wrapper.get('input[type="month"]').setValue('2026-07')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.every(([url]) => url.includes('month=2026-07'))).toBe(
      true,
    )
  })
})
