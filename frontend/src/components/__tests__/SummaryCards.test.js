import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SummaryCards from '../SummaryCards.vue'

describe('SummaryCards', () => {
  it('正确计算收入、支出和结余', () => {
    const wrapper = mount(SummaryCards, {
      props: {
        transactions: [
          {
            id: 1,
            type: 'income',
            amount: 100,
          },
          {
            id: 2,
            type: 'expense',
            amount: 25.5,
          },
        ],
      },
    })

    expect(wrapper.get('[data-test="income-total"]').text()).toContain('¥100.00')
    expect(wrapper.get('[data-test="expense-total"]').text()).toContain('¥25.50')
    expect(wrapper.get('[data-test="balance-total"]').text()).toContain('¥74.50')
  })

  it('优先显示后端返回的真实月度汇总', () => {
    const wrapper = mount(SummaryCards, {
      props: {
        transactions: [{ id: 1, type: 'income', amount: 99999 }],
        summary: {
          month: '2026-08',
          totalIncome: 12000,
          totalExpense: 4286,
          balance: 7714,
          transactionCount: 18,
        },
      },
    })

    expect(wrapper.text()).toContain('2026-08')
    expect(wrapper.text()).toContain('This month: 18 entries')
    expect(wrapper.get('[data-test="income-total"]').text()).toContain(
      '¥12,000.00',
    )
    expect(wrapper.get('[data-test="expense-total"]').text()).toContain(
      '¥4,286.00',
    )
    expect(wrapper.get('[data-test="balance-total"]').text()).toContain(
      '¥7,714.00',
    )
  })

  it('显示加载和接口错误状态', async () => {
    const wrapper = mount(SummaryCards, {
      props: { transactions: [], loading: true },
    })

    expect(wrapper.text()).toContain('Loading this month')
    expect(wrapper.get('[data-test="income-total"]').text()).toBe('—')

    await wrapper.setProps({ loading: false, error: '本月统计暂时不可用' })
    expect(wrapper.text()).toContain('本月统计暂时不可用')
  })
})
