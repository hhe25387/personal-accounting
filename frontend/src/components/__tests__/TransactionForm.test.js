import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TransactionForm from '../TransactionForm.vue'

describe('TransactionForm', () => {
  it('提交完整的支出账目', async () => {
    const wrapper = mount(TransactionForm)

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

  it('自动填入并提交修改后的账目', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
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

    expect(wrapper.get('h2').text()).toBe('编辑账目')
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

  it('取消编辑时通知父组件', async () => {
    const wrapper = mount(TransactionForm, {
      props: {
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
      .find((button) => button.text() === '取消编辑')

    await cancelButton.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
