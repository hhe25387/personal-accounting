<script setup>
import { nextTick, ref } from 'vue'

const isOpen = ref(false)
const inputMessage = ref('')
const isLoading = ref(false)
const messageList = ref(null)
const messages = ref([
  {
    role: 'assistant',
    content:
      '你好，我是你的财务助手。你可以问我最近账目、收支汇总，或者哪个分类花得最多。',
  },
])

const quickQuestions = [
  '最近有哪些账目？',
  '总收入和总支出是多少？',
  '哪个板块花得最多？',
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
    const response = await fetch('http://localhost:3000/api/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: normalizedMessage }),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || '财务助手暂时无法回答')
    }

    messages.value.push({
      role: 'assistant',
      content: result.answer,
    })
  } catch (error) {
    console.error(error)
    messages.value.push({
      role: 'assistant',
      content: '暂时无法连接财务助手，请确认后端已经启动。',
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
    aria-label="打开财务助手"
    @click="openChat"
  >
    <span aria-hidden="true">✦</span>
    财务助手
  </button>

  <div v-if="isOpen" class="agent-backdrop" @click="closeChat"></div>

  <aside
    v-if="isOpen"
    class="agent-drawer"
    aria-label="财务助手聊天窗口"
  >
    <header class="agent-header">
      <div>
        <div class="agent-title-row">
          <span class="agent-status" aria-hidden="true"></span>
          <h2>财务助手</h2>
          <span class="agent-badge">只读模式</span>
        </div>
        <p>只读分析你的账目，不会修改数据</p>
      </div>

      <button
        type="button"
        class="agent-close"
        data-test="close-agent"
        aria-label="关闭财务助手"
        @click="closeChat"
      >
        ×
      </button>
    </header>

    <div class="agent-quick-questions" aria-label="快捷问题">
      <button
        v-for="question in quickQuestions"
        :key="question"
        type="button"
        :disabled="isLoading"
        @click="sendMessage(question)"
      >
        {{ question }}
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
        <span>{{ message.role === 'user' ? '你' : '助手' }}</span>
        <p>{{ message.content }}</p>
      </div>

      <div v-if="isLoading" class="agent-message agent-message--assistant">
        <span>助手</span>
        <p class="agent-typing">正在分析<span>…</span></p>
      </div>
    </div>

    <form class="agent-composer" @submit.prevent="sendMessage()">
      <label class="visually-hidden" for="agent-message">
        输入财务问题
      </label>
      <textarea
        id="agent-message"
        v-model="inputMessage"
        rows="2"
        placeholder="例如：哪个板块花得最多？"
        :disabled="isLoading"
        @keydown.enter.exact.prevent="sendMessage()"
      ></textarea>
      <button
        type="submit"
        data-test="send-agent-message"
        :disabled="isLoading || !inputMessage.trim()"
      >
        {{ isLoading ? '分析中' : '发送' }}
      </button>
    </form>
  </aside>
</template>
