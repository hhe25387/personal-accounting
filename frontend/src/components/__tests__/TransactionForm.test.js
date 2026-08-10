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
})