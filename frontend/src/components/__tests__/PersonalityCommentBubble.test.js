import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PersonalityCommentBubble from '@/components/PersonalityCommentBubble.vue'

const comment = {
  personaName: 'Straight-talking Guide', message: '这笔支出很显眼。',
  evidence: '高于平时。', suggestion: '补一句备注。',
}

afterEach(() => vi.useRealTimers())

describe('PersonalityCommentBubble', () => {
  it('10 秒后自动关闭', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PersonalityCommentBubble, { props: { comment } })
    vi.advanceTimersByTime(10000)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('展开后停止自动关闭并允许反馈', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PersonalityCommentBubble, { props: { comment } })
    await wrapper.get('.bubble-toggle').trigger('click')
    vi.advanceTimersByTime(20000)
    await wrapper.get('[aria-label="Useful note"]').trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.emitted('feedback')[0]).toEqual(['like'])
  })
})
