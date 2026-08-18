import { describe, expect, it } from 'vitest'

import { matchPersonality, PERSONAS } from './personalityMatcher'

describe('personalityMatcher', () => {
  it('朋友陪伴偏好推荐姐妹型', () => {
    expect(matchPersonality(['friend', 'gentle', 'company', 'friend'])).toMatchObject({
      persona: 'bestie',
      toneIntensity: 'gentle',
      proactivity: 'moderate',
      focus: 'companionship',
    })
  })

  it('强烈直接偏好推荐毒舌型', () => {
    expect(matchPersonality(['direct', 'strong', 'impulse', 'truth']).persona).toBe(
      'savage',
    )
  })

  it('私人管家偏好推荐Royal Steward', () => {
    expect(matchPersonality(['quiet', 'gentle', 'clarity', 'butler']).persona).toBe(
      'royal',
    )
  })

  it('人格列表只包含首发的四种人格', () => {
    expect(Object.keys(PERSONAS)).toEqual(['bestie', 'savage', 'parent', 'royal'])
  })
})
