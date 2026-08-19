import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import OverviewView from '../OverviewView.vue'

function response(data) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
}

function monthlyReport(month = '2026-08') {
  return {
    period: { month, startDate: `${month}-01`, endDate: `${month}-31` },
    dataLevel: 'complete',
    summary: {
      totalIncome: 12000,
      totalExpense: 4286,
      balance: 7714,
      transactionCount: 5,
      savingsRate: 64.28,
    },
    activity: {
      activeDays: 3,
      spendingDays: 2,
      averagePerSpendingDay: 2143,
      highestSpendingDay: { date: `${month}-13`, expense: 3000 },
    },
    topCategory: { category: 'Housing', amount: 3000, percentage: 70 },
    largestExpense: {
      amount: 3000,
      category: 'Housing',
      transactionDate: `${month}-13`,
      description: 'Rent',
    },
    comparison: {
      hasPreviousData: true,
      expense: { difference: -420, direction: 'down', percentageChange: -8.93 },
      income: { difference: 0, direction: 'stable', percentageChange: 0 },
      balance: { difference: 420, direction: 'up', percentageChange: 5.76 },
    },
    largestCategoryChange: {
      category: 'Housing', difference: 300, direction: 'up', percentageChange: 11.11,
    },
  }
}

describe('OverviewView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('读取并展示真实月度汇总、每日趋势和分类占比', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/reports/monthly')) return response(monthlyReport())
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

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(wrapper.text()).toContain('¥12,000.00')
    expect(wrapper.text()).toContain('餐饮')
    expect(wrapper.text()).toContain('3 entries · 100%')
    expect(wrapper.text()).toContain('Monthly Report')
    expect(wrapper.text()).toContain('64.28%')
    expect(wrapper.text()).toContain('3 days')
    expect(wrapper.text()).toContain('Housing')
    expect(wrapper.findAll('.daily-column')).toHaveLength(31)
  })

  it('切换月份后重新读取四组月度数据', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/reports/monthly')) return response(monthlyReport('2026-07'))
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

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls.every(([url]) => url.includes('month=2026-07'))).toBe(
      true,
    )
  })

  it('月报接口暂时不可用时仍展示原有统计和图表', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.includes('/reports/monthly')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ message: 'Report unavailable' }),
        })
      }
      if (url.includes('/summary')) {
        return response({
          totalIncome: 100,
          totalExpense: 25,
          balance: 75,
          transactionCount: 2,
        })
      }
      if (url.includes('/daily')) {
        return response({
          endDate: '2026-08-31',
          days: [{ date: '2026-08-18', income: 100, expense: 25 }],
        })
      }
      return response({ categories: [] })
    }))

    const wrapper = mount(OverviewView)
    await flushPromises()

    expect(wrapper.text()).toContain('¥100.00')
    expect(wrapper.findAll('.daily-column')).toHaveLength(31)
    expect(wrapper.text()).toContain('The monthly report is temporarily unavailable.')
  })
})
