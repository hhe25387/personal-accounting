import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import ModeOnboarding from '../ModeOnboarding.vue'

async function answer(wrapper, label) {
  await wrapper.get('.answer-list').get(`button:nth-child(${label})`).trigger('click')
  await wrapper.get('.start-button').trigger('click')
}

describe('ModeOnboarding', () => {
  beforeEach(() => localStorage.clear())

  it('普通模式可以直接进入系统', async () => {
    const wrapper = mount(ModeOnboarding)

    await wrapper.findAll('.mode-card')[0].trigger('click')

    expect(wrapper.emitted('complete')).toEqual([
      [{ mode: 'standard', persona: 'bestie', profile: null }],
    ])
  })

  it('完成四道问题后推荐姐妹型并保存完整偏好', async () => {
    const wrapper = mount(ModeOnboarding)

    await wrapper.findAll('.mode-card')[1].trigger('click')
    await answer(wrapper, 2)
    await answer(wrapper, 2)
    await answer(wrapper, 5)
    await answer(wrapper, 1)

    expect(wrapper.text()).toContain('Recommended for you')
    expect(wrapper.text()).toContain('Supportive')

    await wrapper.get('.result-actions .start-button').trigger('click')

    const selection = wrapper.emitted('complete')[0][0]
    expect(selection.mode).toBe('personality')
    expect(selection.persona).toBe('bestie')
    expect(selection.profile).toMatchObject({
      persona: 'bestie',
      toneIntensity: 'gentle',
      proactivity: 'moderate',
      focus: 'companionship',
    })
    expect(
      JSON.parse(localStorage.getItem('accounting-personality-profile')),
    ).toMatchObject({
      persona: 'bestie',
      toneIntensity: 'gentle',
      proactivity: 'moderate',
      focus: 'companionship',
    })
  })

  it('可以跳过推荐手动选择Royal Steward和Custom称呼', async () => {
    const wrapper = mount(ModeOnboarding)

    await wrapper.findAll('.mode-card')[1].trigger('click')
    await answer(wrapper, 1)
    await answer(wrapper, 1)
    await answer(wrapper, 1)
    await answer(wrapper, 1)
    await wrapper.findAll('.result-actions button')[1].trigger('click')

    const royalCard = wrapper
      .findAll('.persona-card')
      .find((card) => card.text().includes('Royal Steward'))
    await royalCard.trigger('click')
    const customTitleButton = wrapper
      .findAll('.title-picker button')
      .find((button) => button.text() === 'Custom')
    await customTitleButton.trigger('click')
    await wrapper.get('[aria-label="Custom title"]').setValue('Your Majesty')
    await wrapper.get('.onboarding-actions .start-button').trigger('click')

    expect(wrapper.emitted('complete')[0][0]).toMatchObject({
      mode: 'personality',
      persona: 'royal',
      profile: { persona: 'royal', preferredTitle: 'Your Majesty' },
    })
  })

  it('手动列表不再包含挑战或对手型', async () => {
    const wrapper = mount(ModeOnboarding)
    await wrapper.findAll('.mode-card')[1].trigger('click')
    await answer(wrapper, 1)
    await answer(wrapper, 1)
    await answer(wrapper, 1)
    await answer(wrapper, 1)
    await wrapper.findAll('.result-actions button')[1].trigger('click')

    expect(wrapper.text()).not.toContain('挑战型')
    expect(wrapper.text()).not.toContain('对手型')
    expect(wrapper.findAll('.persona-card')).toHaveLength(4)
  })

  it('已经完成过测试时直接进入人格选择列表', async () => {
    const wrapper = mount(ModeOnboarding, {
      props: {
        existingProfile: {
          persona: 'parent',
          toneIntensity: 'gentle',
          proactivity: 'moderate',
          focus: 'saving',
        },
      },
    })

    await wrapper.findAll('.mode-card')[1].trigger('click')

    expect(wrapper.find('.quiz-step').exists()).toBe(false)
    expect(wrapper.findAll('.persona-card')).toHaveLength(4)
    expect(wrapper.text()).toContain('earlier answers are saved')
    expect(
      wrapper
        .findAll('.persona-card')
        .find((card) => card.text().includes('Caring Mentor'))
        .classes(),
    ).toContain('selected')
  })
})
