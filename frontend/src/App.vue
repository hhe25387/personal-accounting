<script setup>
import { onMounted, provide, ref } from 'vue'
import { RouterView } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import AuthGate from '@/components/AuthGate.vue'
import ModeOnboarding from '@/components/ModeOnboarding.vue'
import PersonalityWelcome from '@/components/PersonalityWelcome.vue'
import { personalityFeatureEnabled } from '@/config/features'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const authChecking = ref(true)
const authenticated = ref(false)
const onboardingComplete = ref(false)
const mode = ref(localStorage.getItem('accounting-demo-mode') || 'standard')
const personalityProfile = ref(loadPersonalityProfile())
const personalityHistoryProfile = ref(loadPersonalityHistoryProfile())
const showPersonalityWelcome = ref(false)
const user = ref({
  name: localStorage.getItem('accounting-demo-name') || 'Ledger User',
  account: localStorage.getItem('accounting-demo-account') || '',
})

provide('personalityContext', {
  mode,
  profile: personalityProfile,
})

provide('authContext', {
  user,
  logout,
  updateUser,
})

function updateUser(nextUser) {
  user.value = nextUser
  localStorage.setItem('accounting-demo-name', nextUser.name)
  localStorage.setItem('accounting-demo-account', nextUser.account)
}

function loadPersonalityProfile() {
  try {
    return JSON.parse(localStorage.getItem('accounting-personality-profile'))
  } catch {
    return null
  }
}

function loadPersonalityHistoryProfile() {
  try {
    return JSON.parse(
      localStorage.getItem('accounting-personality-history-profile'),
    )
  } catch {
    return null
  }
}

function cachePreferences(preferences) {
  if (!preferences) {
    localStorage.removeItem('accounting-demo-mode')
    localStorage.removeItem('accounting-demo-persona')
    localStorage.removeItem('accounting-personality-profile')
    localStorage.removeItem('accounting-personality-history-profile')
    mode.value = 'standard'
    personalityProfile.value = null
    personalityHistoryProfile.value = null
    onboardingComplete.value = false
    return
  }

  mode.value = preferences.mode
  personalityProfile.value = preferences.profile
  personalityHistoryProfile.value =
    preferences.savedProfile || preferences.profile || null
  onboardingComplete.value = true
  localStorage.setItem('accounting-demo-mode', preferences.mode)
  if (preferences.profile) {
    localStorage.setItem('accounting-demo-persona', preferences.profile.persona)
    localStorage.setItem(
      'accounting-personality-profile',
      JSON.stringify(preferences.profile),
    )
  } else {
    localStorage.removeItem('accounting-demo-persona')
    localStorage.removeItem('accounting-personality-profile')
  }
  if (personalityHistoryProfile.value) {
    localStorage.setItem(
      'accounting-personality-history-profile',
      JSON.stringify(personalityHistoryProfile.value),
    )
  }
}

function applyFeaturePolicy() {
  if (personalityFeatureEnabled) return
  mode.value = 'standard'
  personalityProfile.value = null
  onboardingComplete.value = true
  showPersonalityWelcome.value = false
}

async function loadUserPreferences() {
  const response = await fetch('http://localhost:3000/api/preferences', {
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Could not load user preferences')
  const result = await response.json()
  cachePreferences(result.preferences)
  applyFeaturePolicy()
}

async function finishAuthentication(nextUser) {
  updateUser(nextUser)
  authenticated.value = true
  authChecking.value = true
  try {
    await loadUserPreferences()
    showPersonalityWelcome.value =
      onboardingComplete.value &&
      mode.value === 'personality' &&
      Boolean(personalityProfile.value)
  } catch (error) {
    console.error(error)
    cachePreferences(null)
    applyFeaturePolicy()
  } finally {
    authChecking.value = false
  }
}

async function finishOnboarding(selection) {
  mode.value = selection.mode
  personalityProfile.value = selection.profile
  if (selection.profile) personalityHistoryProfile.value = selection.profile
  onboardingComplete.value = true
  showPersonalityWelcome.value =
    selection.mode === 'personality' && Boolean(selection.profile)
  try {
    const response = await fetch('http://localhost:3000/api/preferences', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: selection.mode, profile: selection.profile }),
    })
    if (!response.ok) throw new Error('Could not save user preferences')
    const result = await response.json()
    cachePreferences(result.preferences)
  } catch (error) {
    console.error(error)
  }
}

function finishWelcome() {
  showPersonalityWelcome.value = false
}

async function logout() {
  try {
    await fetch('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch (error) {
    console.error(error)
  }
  authenticated.value = false
  onboardingComplete.value = false
  showPersonalityWelcome.value = false
  cachePreferences(null)
  localStorage.removeItem('accounting-demo-name')
  localStorage.removeItem('accounting-demo-account')
}

function changeMode() {
  onboardingComplete.value = false
  showPersonalityWelcome.value = false
}

async function restoreSession() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/me', {
      credentials: 'include',
    })
    if (!response.ok) return
    const result = await response.json()
    updateUser(result.user)
    authenticated.value = true
    await loadUserPreferences()
    showPersonalityWelcome.value =
      onboardingComplete.value &&
      mode.value === 'personality' &&
      Boolean(personalityProfile.value)
  } catch (error) {
    console.error(error)
  } finally {
    authChecking.value = false
  }
}

onMounted(restoreSession)
</script>

<template>
  <main v-if="authChecking" class="app-loading" aria-live="polite">
    <span aria-hidden="true">L</span>
    <p>{{ t('Opening your ledger…') }}</p>
  </main>
  <AuthGate v-else-if="!authenticated" @authenticated="finishAuthentication" />
  <ModeOnboarding
    v-else-if="personalityFeatureEnabled && !onboardingComplete"
    :existing-profile="personalityHistoryProfile"
    @complete="finishOnboarding"
    @logout="logout"
  />
  <PersonalityWelcome
    v-else-if="personalityFeatureEnabled && showPersonalityWelcome"
    :profile="personalityProfile"
    :user-name="user.name"
    @enter="finishWelcome"
  />
  <AppShell
    v-else
    :user="user"
    :mode="mode"
    :allow-mode-change="personalityFeatureEnabled"
    @logout="logout"
    @change-mode="changeMode"
  >
    <RouterView />
  </AppShell>
</template>

<style scoped>
.app-loading{display:grid;min-height:100vh;place-content:center;justify-items:center;gap:14px;color:#284638;background:#f2efe7}.app-loading span{display:grid;width:52px;height:52px;place-items:center;border-radius:15px;color:#284638;background:#f2c35d;font-weight:900}.app-loading p{margin:0;color:#6f7972}
</style>
