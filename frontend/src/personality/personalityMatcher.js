export const PERSONAS = {
  bestie: {
    id: 'bestie',
    icon: '👯',
    name: 'Supportive',
    label: 'Bestie',
    copy: 'Reviews your spending like a friend—understanding first, then gentle honesty.',
  },
  savage: {
    id: 'savage',
    icon: '😈',
    name: 'Straight-talking',
    label: 'Savage',
    copy: 'Calls out unnecessary spending directly without judging your worth.',
  },
  parent: {
    id: 'parent',
    icon: '🏡',
    name: 'Caring Mentor',
    label: 'Caring Parent',
    copy: 'Supports essential spending while watching waste and long-term plans.',
  },
  royal: {
    id: 'royal',
    icon: '👑',
    name: 'Royal Steward',
    label: 'Royal Butler',
    copy: 'Adds a little ceremony and offers tactful reminders worthy of your title.',
  },
}

export const MATCH_QUESTIONS = [
  {
    id: 'companionship',
    title: 'How should your companion support you?',
    description: 'There are no wrong answers—choose what feels sustainable.',
    options: [
      { id: 'quiet', label: 'Track quietly and analyze when asked', scores: {}, proactivity: 'quiet' },
      { id: 'friend', label: 'Talk it through like a friend', scores: { bestie: 3 }, proactivity: 'moderate' },
      { id: 'supervise', label: 'Watch actively and flag issues', scores: { parent: 3 }, proactivity: 'active' },
      { id: 'direct', label: 'Be direct and keep me accountable', scores: { savage: 3 }, proactivity: 'active' },
    ],
  },
  {
    id: 'directness',
    title: 'How direct should spending feedback be?',
    description: 'This sets how direct your companion will be.',
    options: [
      { id: 'facts', label: 'Just show me the numbers', scores: { parent: 1 }, tone: 'gentle' },
      { id: 'gentle', label: 'Remind me gently, without pressure', scores: { bestie: 2, royal: 1 }, tone: 'gentle' },
      { id: 'tease', label: 'A little playful teasing is fine', scores: { bestie: 1, savage: 2 }, tone: 'medium' },
      { id: 'strong', label: 'Be blunt when the facts support it', scores: { savage: 4 }, tone: 'strong' },
    ],
  },
  {
    id: 'goal',
    title: 'What do you most want to improve?',
    description: 'Your companion will focus on the area you choose.',
    options: [
      { id: 'clarity', label: 'Understand where my money goes', scores: { parent: 1 }, focus: 'clarity' },
      { id: 'impulse', label: 'Reduce impulse and unnecessary spending', scores: { savage: 2, parent: 1 }, focus: 'impulse_control' },
      { id: 'habit', label: 'Build a consistent tracking habit', scores: { bestie: 1, parent: 2 }, focus: 'habit' },
      { id: 'saving', label: 'Save more for the future', scores: { parent: 3 }, focus: 'saving' },
      { id: 'company', label: 'Have support while managing daily life', scores: { bestie: 3, royal: 1 }, focus: 'companionship' },
    ],
  },
  {
    id: 'relationship',
    title: 'Which relationship style feels best?',
    description: 'This shapes your companion’s core style.',
    options: [
      { id: 'friend', label: 'A friend who understands me', scores: { bestie: 5 } },
      { id: 'family', label: 'A caring family member', scores: { parent: 5 } },
      { id: 'truth', label: 'A candid friend who tells the truth', scores: { savage: 5 } },
      { id: 'butler', label: 'A loyal, elegant private steward', scores: { royal: 5 } },
    ],
  },
]

export function matchPersonality(answerIds) {
  const scores = Object.fromEntries(Object.keys(PERSONAS).map((id) => [id, 0]))
  const profile = {
    toneIntensity: 'medium',
    proactivity: 'moderate',
    focus: 'clarity',
  }

  MATCH_QUESTIONS.forEach((question, index) => {
    const option = question.options.find((item) => item.id === answerIds[index])
    if (!option) return
    for (const [persona, score] of Object.entries(option.scores)) {
      scores[persona] += score
    }
    if (option.tone) profile.toneIntensity = option.tone
    if (option.proactivity) profile.proactivity = option.proactivity
    if (option.focus) profile.focus = option.focus
  })

  const persona = Object.entries(scores).sort((left, right) => right[1] - left[1])[0][0]
  return { persona, scores, ...profile }
}

export function getRecommendationReason(profile) {
  const personaReasons = {
    bestie: 'You prefer understanding and companionship over pure supervision. The Supportive companion reviews things with you and speaks up when it matters.',
    savage: 'You welcome direct feedback and want help seeing through spending excuses. The Straight-talking guide critiques behavior, never your worth.',
    parent: 'You value gentle supervision, quality of life, and long-term planning. The Caring mentor supports essential spending and flags waste.',
    royal: 'You enjoy a sense of occasion and thoughtful attention. The Royal steward is gracious while gently watching the treasury.',
  }
  return personaReasons[profile.persona]
}
