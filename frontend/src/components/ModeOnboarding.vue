<script setup>
import { computed, ref } from 'vue'

import {
  getRecommendationReason,
  MATCH_QUESTIONS,
  matchPersonality,
  PERSONAS,
} from '@/personality/personalityMatcher'

const props = defineProps({
  existingProfile: { type: Object, default: null },
})
const emit = defineEmits(['complete', 'logout'])
const step = ref('mode')
const questionIndex = ref(0)
const answers = ref([])
const selectedPersona = ref(props.existingProfile?.persona || 'bestie')
const recommendation = ref(null)
const royalTitle = ref('Your Highness')
const customTitle = ref('')

const currentQuestion = computed(() => MATCH_QUESTIONS[questionIndex.value])
const currentAnswer = computed(() => answers.value[questionIndex.value])
const selectedPersonaInfo = computed(() => PERSONAS[selectedPersona.value])
const profileLabels = computed(() => {
  if (!recommendation.value) return null
  const tone = { gentle: 'Gentle', medium: 'Balanced', strong: 'Direct' }
  const proactivity = { quiet: 'Quiet', moderate: 'Balanced', active: 'Active' }
  const focus = {
    clarity: 'Cash-flow clarity',
    impulse_control: 'Impulse control',
    habit: 'Tracking habits',
    saving: 'Savings plan',
    companionship: 'Support',
  }
  return {
    tone: tone[recommendation.value.toneIntensity],
    proactivity: proactivity[recommendation.value.proactivity],
    focus: focus[recommendation.value.focus],
  }
})
const finalTitle = computed(() =>
  royalTitle.value === 'Custom' ? customTitle.value.trim() || 'Your Highness' : royalTitle.value,
)

function beginQuiz() {
  step.value = 'quiz'
  questionIndex.value = 0
  answers.value = []
  recommendation.value = null
}

function startPersonality() {
  if (props.existingProfile) {
    selectedPersona.value = props.existingProfile.persona
    step.value = 'manual'
    return
  }
  beginQuiz()
}

function selectAnswer(answerId) {
  answers.value[questionIndex.value] = answerId
}

function nextQuestion() {
  if (!currentAnswer.value) return
  if (questionIndex.value < MATCH_QUESTIONS.length - 1) {
    questionIndex.value += 1
    return
  }

  recommendation.value = matchPersonality(answers.value)
  selectedPersona.value = recommendation.value.persona
  step.value = 'result'
}

function previousQuestion() {
  if (questionIndex.value > 0) questionIndex.value -= 1
  else step.value = 'mode'
}

function chooseManually() {
  step.value = 'manual'
}

function finish(mode) {
  const profile =
    mode === 'standard'
      ? null
      : {
          ...(
            recommendation.value ||
            props.existingProfile ||
            matchPersonality(answers.value)
          ),
          persona: selectedPersona.value,
          preferredTitle:
            selectedPersona.value === 'royal' ? finalTitle.value : undefined,
        }

  localStorage.setItem('accounting-demo-mode', mode)
  localStorage.setItem('accounting-demo-persona', selectedPersona.value)
  if (profile) {
    localStorage.setItem('accounting-personality-profile', JSON.stringify(profile))
  } else {
    localStorage.removeItem('accounting-personality-profile')
  }
  emit('complete', { mode, persona: selectedPersona.value, profile })
}
</script>

<template>
  <main class="onboarding-shell">
    <button class="logout-link" type="button" @click="emit('logout')">Sign out</button>

    <section v-if="step === 'mode'" class="mode-step">
      <div class="onboarding-copy">
        <p class="eyebrow">PERSONAL ACCOUNTING</p>
        <h1>Choose your tracking style</h1>
        <p>The tools stay simple; you choose the tone and can change it later.</p>
      </div>
      <div class="mode-grid">
        <button class="mode-card" type="button" @click="finish('standard')">
          <span>01</span><h2>Standard Tracking</h2><p>Quiet and direct, with entries, categories, overview, and recent activity.</p><strong>Continue →</strong>
        </button>
        <button class="mode-card mode-card--accent" type="button" @click="startPersonality">
          <span>02</span><h2>Personality Companion</h2><p>{{ existingProfile ? 'Browse every style and choose the one that suits you now.' : 'Answer four short questions to find your preferred support style.' }}</p><strong>{{ existingProfile ? 'Choose a companion →' : 'Start matching · about 30 seconds →' }}</strong>
        </button>
      </div>
    </section>

    <section v-else-if="step === 'quiz'" class="quiz-step">
      <div class="quiz-progress"><span>PERSONALITY MATCH</span><strong>{{ questionIndex + 1 }} / {{ MATCH_QUESTIONS.length }}</strong></div>
      <div class="progress-track"><i :style="{ width: `${((questionIndex + 1) / MATCH_QUESTIONS.length) * 100}%` }"></i></div>
      <div class="question-copy"><p class="eyebrow">QUESTION {{ questionIndex + 1 }}</p><h1>{{ currentQuestion.title }}</h1><p>{{ currentQuestion.description }}</p></div>
      <div class="answer-list">
        <button v-for="option in currentQuestion.options" :key="option.id" type="button" :class="{ selected: currentAnswer === option.id }" @click="selectAnswer(option.id)">
          <span>{{ option.label }}</span><b>{{ currentAnswer === option.id ? '✓' : '○' }}</b>
        </button>
      </div>
      <div class="onboarding-actions"><button type="button" @click="previousQuestion">← Back</button><button class="start-button" type="button" :disabled="!currentAnswer" @click="nextQuestion">{{ questionIndex === MATCH_QUESTIONS.length - 1 ? 'See recommendation' : 'Next' }} →</button></div>
    </section>

    <section v-else-if="step === 'result'" class="result-step">
      <div class="result-card">
        <p class="eyebrow">YOUR MATCH</p>
        <span class="result-icon">{{ selectedPersonaInfo.icon }}</span>
        <p>Recommended for you</p><h1>{{ selectedPersonaInfo.name }}</h1><small>{{ selectedPersonaInfo.label }}</small>
        <p class="result-reason">{{ getRecommendationReason(recommendation) }}</p>
        <div class="profile-tags"><span>Tone: {{ profileLabels.tone }}</span><span>Proactivity: {{ profileLabels.proactivity }}</span><span>Focus: {{ profileLabels.focus }}</span></div>
      </div>

      <div v-if="selectedPersona === 'royal'" class="title-picker">
        <strong>How should your steward address you?</strong>
        <div><button v-for="title in ['Your Highness', 'Princess', 'Prince', 'My Liege', 'Custom']" :key="title" type="button" :class="{ selected: royalTitle === title }" @click="royalTitle = title">{{ title }}</button></div>
        <input v-if="royalTitle === 'Custom'" v-model="customTitle" maxlength="10" placeholder="Up to 10 characters" aria-label="Custom title" />
      </div>

      <div class="result-actions"><button class="start-button" type="button" @click="finish('personality')">Start with this companion</button><button type="button" @click="chooseManually">See other styles</button><button type="button" @click="beginQuiz">Retake quiz</button></div>
    </section>

    <section v-else class="manual-step">
      <div class="onboarding-copy"><p class="eyebrow">CHOOSE YOURSELF</p><h1>{{ existingProfile ? 'Who should join you this time?' : 'You can trust your own instinct' }}</h1><p>{{ existingProfile ? 'Your earlier answers are saved. Choose the companion that suits you now.' : 'The recommendation is only a guide. The final choice is yours.' }}</p></div>
      <div class="persona-grid">
        <button v-for="item in Object.values(PERSONAS)" :key="item.id" type="button" class="persona-card" :class="{ selected: selectedPersona === item.id }" @click="selectedPersona = item.id">
          <span>{{ item.icon }}</span><div><h2>{{ item.name }} <small>{{ item.label }}</small></h2><p>{{ item.copy }}</p></div><b>{{ selectedPersona === item.id ? '✓' : '' }}</b>
        </button>
      </div>
      <div v-if="selectedPersona === 'royal'" class="title-picker"><strong>How should your steward address you?</strong><div><button v-for="title in ['Your Highness', 'Princess', 'Prince', 'My Liege', 'Custom']" :key="title" type="button" :class="{ selected: royalTitle === title }" @click="royalTitle = title">{{ title }}</button></div><input v-if="royalTitle === 'Custom'" v-model="customTitle" maxlength="10" placeholder="Up to 10 characters" aria-label="Custom title" /></div>
      <div class="onboarding-actions"><button type="button" @click="step = recommendation ? 'result' : 'mode'">← Back</button><button class="start-button" type="button" @click="finish('personality')">Continue with this companion</button></div>
    </section>
  </main>
</template>

<style scoped>
.onboarding-shell{position:relative;min-height:100vh;padding:clamp(34px,6vw,78px);color:#20352b;background:#f2efe7}.logout-link{position:absolute;top:28px;right:34px;border:0;color:#657068;background:transparent;cursor:pointer}.onboarding-copy{max-width:820px;margin:2vh auto 45px;text-align:center}.eyebrow{color:#2d6049;font-size:.75rem;font-weight:800;letter-spacing:.16em}.onboarding-copy h1,.question-copy h1,.result-card h1{margin:12px 0;font-family:Georgia,serif;font-size:clamp(2.7rem,6vw,5.8rem);font-weight:500;line-height:1}.onboarding-copy>p:last-child,.question-copy>p:last-child{color:#68736c;font-size:1.05rem}.mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,440px));justify-content:center;gap:20px}.mode-card{min-height:290px;padding:32px;border:1px solid #d8d7ce;border-radius:22px;text-align:left;background:#fffdf8;cursor:pointer;transition:.2s}.mode-card:hover{transform:translateY(-3px);box-shadow:0 20px 44px rgba(41,51,44,.1)}.mode-card--accent{color:#f8f4ea;background:#274536}.mode-card>span{font-size:.76rem;font-weight:800;letter-spacing:.14em}.mode-card h2{margin:52px 0 10px;font-family:Georgia,serif;font-size:2rem}.mode-card p{min-height:52px;color:#68736c}.mode-card--accent p{color:#cbd6cf}.mode-card strong{display:block;margin-top:34px}.quiz-step{max-width:820px;margin:auto}.quiz-progress{display:flex;justify-content:space-between;color:#68736c}.progress-track{height:5px;margin:10px 0 54px;overflow:hidden;border-radius:99px;background:#deddd5}.progress-track i{display:block;height:100%;border-radius:inherit;background:#2d6049;transition:width .2s}.question-copy{margin-bottom:30px}.question-copy h1{max-width:760px;font-size:clamp(2.5rem,5vw,4.7rem)}.answer-list{display:grid;gap:10px}.answer-list button{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border:1px solid #d8d7ce;border-radius:14px;text-align:left;background:#fffdf8;cursor:pointer}.answer-list button.selected{border-color:#2d6049;background:#eaf2ed;box-shadow:0 0 0 2px rgba(45,96,73,.1)}.answer-list b{color:#2d6049}.onboarding-actions,.result-actions{display:flex;justify-content:space-between;gap:10px;margin-top:24px}.onboarding-actions button,.result-actions button{padding:12px 18px;border:1px solid #cfd2cc;border-radius:10px;background:#fffdf8;font-weight:750;cursor:pointer}.onboarding-actions .start-button,.result-actions .start-button{border-color:#2d6049;color:#fff;background:#2d6049}.onboarding-actions button:disabled{cursor:not-allowed;opacity:.45}.result-step{max-width:850px;margin:auto;text-align:center}.result-card{padding:35px;border:1px solid #d8d7ce;border-radius:25px;background:#fffdf8}.result-icon{font-size:3.2rem}.result-card>p{color:#68736c}.result-card h1{font-size:clamp(2.8rem,6vw,5.4rem)}.result-card small{color:#68736c;letter-spacing:.12em}.result-reason{max-width:650px;margin:24px auto!important;font-size:1.02rem;line-height:1.7}.profile-tags{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.profile-tags span{padding:7px 11px;border-radius:99px;color:#2d6049;background:#eaf2ed;font-size:.78rem}.result-actions{justify-content:center;flex-wrap:wrap}.persona-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.persona-card{position:relative;display:flex;min-height:210px;flex-direction:column;gap:17px;padding:22px;border:1px solid #d8d7ce;border-radius:18px;text-align:left;background:#fffdf8;cursor:pointer}.persona-card.selected{border-color:#2d6049;box-shadow:0 0 0 3px rgba(45,96,73,.1)}.persona-card>span{font-size:2rem}.persona-card h2{margin:0;font-family:Georgia,serif}.persona-card h2 small{display:block;margin-top:5px;color:#7b837d;font-family:inherit;font-size:.7rem}.persona-card p{color:#68736c;font-size:.88rem}.persona-card>b{position:absolute;top:16px;right:16px;color:#2d6049}.manual-step{max-width:1120px;margin:auto}.title-picker{max-width:720px;margin:18px auto;padding:18px;border:1px solid #d8d7ce;border-radius:16px;background:#fffdf8}.title-picker>strong{display:block;margin-bottom:12px}.title-picker>div{display:flex;flex-wrap:wrap;justify-content:center;gap:7px}.title-picker button{padding:8px 12px;border:1px solid #d8d7ce;border-radius:99px;background:#fff;cursor:pointer}.title-picker button.selected{border-color:#2d6049;color:#fff;background:#2d6049}.title-picker input{width:min(300px,100%);margin-top:12px;padding:10px 12px;border:1px solid #d8d7ce;border-radius:9px}@media(max-width:850px){.persona-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.onboarding-shell{padding:70px 20px 34px}.onboarding-copy{margin:0 auto 28px}.onboarding-copy h1{font-size:2.6rem}.mode-grid,.persona-grid{grid-template-columns:1fr}.mode-card{min-height:220px}.mode-card h2{margin-top:30px}.persona-card{min-height:auto}.progress-track{margin-bottom:35px}.onboarding-actions{position:sticky;bottom:12px;padding:10px;border-radius:14px;background:rgba(242,239,231,.94)}.result-actions{display:grid}.result-actions .start-button{order:-1}}
</style>
