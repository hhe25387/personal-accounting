<script setup>
import { nextTick, ref } from 'vue'
import { useI18n } from '@/i18n'
import { apiRequest } from '@/services/apiClient'

const { language, t } = useI18n()

const isOpen = ref(false)
const inputMessage = ref('')
const isLoading = ref(false)
const messageList = ref(null)
const messages = ref([
  {
    role: 'assistant',
    content: 'Hi, I am your financial assistant. Ask about recent transactions, totals, or your top spending category.',
  },
])

const quickQuestions = [
  'What are my recent transactions?',
  'What are my total income and expenses?',
  'Which category has the most spending?',
  'How is this month different from last month?',
  'Summarize this month and give me one practical suggestion.',
]

async function scrollToLatestMessage() {
  await nextTick()

  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}

function openChat() {
  isOpen.value = true
  scrollToLatestMessage()
}

function closeChat() {
  isOpen.value = false
}

async function sendMessage(message = inputMessage.value) {
  const normalizedMessage = message.trim()

  if (!normalizedMessage || isLoading.value) {
    return
  }

  messages.value.push({
    role: 'user',
    content: normalizedMessage,
  })
  inputMessage.value = ''
  isLoading.value = true
  await scrollToLatestMessage()

  try {
    const result = await apiRequest('/api/assistant', {
      method: 'POST',
      body: {
        message: normalizedMessage,
        language: language.value,
      },
      fallbackMessage: 'The financial assistant cannot answer right now',
    })

    messages.value.push({
      role: 'assistant',
      content: result.answer,
      grounding: result.grounding || null,
    })
  } catch (error) {
    console.error(error)
    messages.value.push({
      role: 'assistant',
      content: t('Cannot connect to the financial assistant. Make sure the backend is running.'),
      isError: true,
    })
  } finally {
    isLoading.value = false
    await scrollToLatestMessage()
  }
}
</script>

<template>
  <button
    v-if="!isOpen"
    type="button"
    class="agent-launcher"
    data-test="open-agent"
    :aria-label="t('Open financial assistant')"
    @click="openChat"
  >
    <span aria-hidden="true">✦</span>
    {{ t('Financial Assistant') }}
  </button>

  <div v-if="isOpen" class="agent-backdrop" @click="closeChat"></div>

  <aside
    v-if="isOpen"
    class="agent-drawer"
    :aria-label="t('Financial assistant chat')"
  >
    <header class="agent-header">
      <div>
        <div class="agent-title-row">
          <span class="agent-status" aria-hidden="true"></span>
          <h2>{{ t('Financial Assistant') }}</h2>
          <span class="agent-badge">{{ t('Read-only') }}</span>
        </div>
        <p>{{ t('Analyzes your transactions without changing data') }}</p>
      </div>

      <button
        type="button"
        class="agent-close"
        data-test="close-agent"
        :aria-label="t('Close financial assistant')"
        @click="closeChat"
      >
        ×
      </button>
    </header>

    <div class="agent-quick-questions" :aria-label="t('Suggested questions')">
      <button
        v-for="question in quickQuestions"
        :key="question"
        type="button"
        :disabled="isLoading"
        @click="sendMessage(question)"
      >
        {{ t(question) }}
      </button>
    </div>

    <div ref="messageList" class="agent-messages" aria-live="polite">
      <div
        v-for="(message, index) in messages"
        :key="index"
        class="agent-message"
        :class="[
          `agent-message--${message.role}`,
          { 'agent-message--error': message.isError },
        ]"
      >
        <span>{{ t(message.role === 'user' ? 'You' : 'Assistant') }}</span>
        <p>{{ t(message.content) }}</p>
        <small v-if="message.grounding" class="agent-grounding">
          <span aria-hidden="true">✓</span>
          {{ t('Verified from your ledger') }}
          ·
          {{ message.grounding.evidenceCount ? (language === 'zh' ? `${message.grounding.evidenceCount} 笔` : `${message.grounding.evidenceCount} entries`) : t('No transactions were used') }}
          ·
          {{ t('Read-only analysis') }}
        </small>
      </div>

      <div v-if="isLoading" class="agent-message agent-message--assistant">
        <span>{{ t('Assistant') }}</span>
        <p class="agent-typing">{{ t('Analyzing') }}<span>…</span></p>
      </div>
    </div>

    <form class="agent-composer" @submit.prevent="sendMessage()">
      <label class="visually-hidden" for="agent-message">
        {{ t('Ask a financial question') }}
      </label>
      <textarea
        id="agent-message"
        v-model="inputMessage"
        rows="2"
        :placeholder="t('e.g. Which category has the most spending?')"
        :disabled="isLoading"
        @keydown.enter.exact.prevent="sendMessage()"
      ></textarea>
      <button
        type="submit"
        data-test="send-agent-message"
        :disabled="isLoading || !inputMessage.trim()"
      >
        {{ t(isLoading ? 'Analyzing' : 'Send') }}
      </button>
    </form>
  </aside>
</template>
