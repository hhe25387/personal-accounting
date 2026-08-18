<script setup>
import { computed, nextTick, ref } from 'vue'
import { useI18n } from '@/i18n'
import { apiRequest } from '@/services/apiClient'

const { language, setLanguage, t } = useI18n()

const emit = defineEmits(['authenticated'])

const view = ref('login')
const isSubmitting = ref(false)
const statusMessage = ref('Your account will be securely verified by the local server.')
const statusTone = ref('neutral')
const loginAccount = ref('')
const loginPassword = ref('')
const registerName = ref('')
const registerAccount = ref('')
const registerPassword = ref('')
const registerConfirm = ref('')
const registerAgreed = ref(false)
const recoveryAccount = ref('')
const recoveryCode = ref('')
const resetPassword = ref('')
const resetConfirm = ref('')
const showPassword = ref(false)
const errors = ref({})

const headings = {
  login: ['Welcome back', 'Sign in to continue tracking every income and expense.'],
  register: ['Create your ledger', 'Start with one entry and gradually understand where your money goes.'],
  forgot: ['Recover your password', 'Enter the email or phone number you used to register.'],
  reset: ['Set a new password', 'Use at least 8 characters with both letters and numbers.'],
  success: ['Password updated', 'You can now sign in with your new password.'],
}

const currentHeading = computed(() => headings[view.value].map(t))

function setView(nextView) {
  view.value = nextView
  errors.value = {}
  statusTone.value = 'neutral'
  statusMessage.value = 'Your account will be securely verified by the local server.'
  nextTick(() => document.querySelector('.auth-card input')?.focus())
}

function validateAccount(value) {
  const normalized = value.trim()
  if (!normalized) return 'Enter your email or phone number'
  if (normalized.includes('@') && !/^\S+@\S+\.\S+$/.test(normalized)) {
    return 'Enter a valid email address'
  }
  return ''
}

function validatePassword(value) {
  if (!value) return 'Enter your password'
  if (value.length < 8) return 'Password must be at least 8 characters'
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include letters and numbers'
  }
  return ''
}

function authenticate(name, account) {
  emit('authenticated', { name: name || 'Ledger User', account: account || '' })
}

async function submitLogin() {
  errors.value = {
    account: validateAccount(loginAccount.value),
    password: loginPassword.value ? '' : 'Enter your password',
  }
  if (errors.value.account || errors.value.password) return

  isSubmitting.value = true
  statusMessage.value = 'Verifying your account…'
  statusTone.value = 'neutral'
  try {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        account: loginAccount.value.trim(),
        password: loginPassword.value,
      },
      fallbackMessage: 'Sign-in failed',
      notifyUnauthorized: false,
    })
    statusTone.value = 'success'
    statusMessage.value = 'Signed in. Opening your ledger…'
    authenticate(result.user.name, result.user.account)
  } catch (error) {
    statusTone.value = 'error'
    statusMessage.value = error.message === 'Failed to fetch'
      ? 'Cannot connect to the server. Please start the backend service.'
      : error.message
  } finally {
    isSubmitting.value = false
  }
}

async function submitRegister() {
  errors.value = {
    name: registerName.value.trim() ? '' : 'Enter a display name',
    account: validateAccount(registerAccount.value),
    password: validatePassword(registerPassword.value),
    confirm:
      registerConfirm.value === registerPassword.value ? '' : 'Passwords do not match',
    agreed: registerAgreed.value ? '' : 'Please agree to the Terms of Service and Privacy Policy',
  }
  if (Object.values(errors.value).some(Boolean)) return

  isSubmitting.value = true
  statusMessage.value = 'Creating your account…'
  statusTone.value = 'neutral'
  try {
    const result = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: registerName.value.trim(),
        account: registerAccount.value.trim(),
        password: registerPassword.value,
      },
      fallbackMessage: 'Registration failed',
      notifyUnauthorized: false,
    })
    statusTone.value = 'success'
    statusMessage.value = 'Account created. Opening your ledger…'
    authenticate(result.user.name, result.user.account)
  } catch (error) {
    statusTone.value = 'error'
    statusMessage.value = error.message === 'Failed to fetch'
      ? 'Cannot connect to the server. Please start the backend service.'
      : error.message
  } finally {
    isSubmitting.value = false
  }
}

function sendCode() {
  const account = recoveryAccount.value
  const message = validateAccount(account)
  errors.value = { ...errors.value, account: message }
  if (message) return
  statusTone.value = 'success'
  statusMessage.value = 'Password recovery requires email or SMS service, which is not connected yet.'
}

function submitRecovery() {
  errors.value = {
    account: validateAccount(recoveryAccount.value),
    code: recoveryCode.value.trim() ? '' : 'Enter the verification code',
  }
  if (errors.value.account || errors.value.code) return
  setView('reset')
}

function submitReset() {
  errors.value = {
    password: validatePassword(resetPassword.value),
    confirm: resetConfirm.value === resetPassword.value ? '' : 'Passwords do not match',
  }
  if (errors.value.password || errors.value.confirm) return
  setView('success')
}
</script>

<template>
  <main class="auth-shell">
    <div class="auth-language-switch" role="group" :aria-label="t('Language')">
      <button type="button" :class="{ active: language === 'en' }" @click="setLanguage('en')">EN</button>
      <button type="button" :class="{ active: language === 'zh' }" @click="setLanguage('zh')">中文</button>
    </div>
    <section class="auth-brand-panel">
      <div class="auth-brand">
        <span aria-hidden="true">L</span>
        <div><strong>{{ t('Clear Ledger') }}</strong><small>{{ t('Personal income and expense tracker') }}</small></div>
      </div>
      <div class="auth-copy">
        <p class="eyebrow">{{ t('PERSONAL ACCOUNTING') }}</p>
        <h1>{{ t('Money tracking does not have to feel serious,\nwhat matters is getting started.').split('\n')[0] }}<br />{{ t('Money tracking does not have to feel serious,\nwhat matters is getting started.').split('\n')[1] }}</h1>
        <p>{{ t('Track each transaction and see your financial life more clearly.') }}</p>
      </div>
      <div class="ledger-preview" :aria-label="t('Demo data')">
        <div><span>{{ t('Entries today') }}</span><strong>{{ t('3 entries') }}</strong></div>
        <div><span>{{ t('Monthly income') }}</span><strong>¥12,000</strong></div>
        <div><span>{{ t('Monthly expenses') }}</span><strong>¥4,286</strong></div>
        <small>{{ t('Demo data') }}</small>
      </div>
    </section>

    <section class="auth-card" aria-live="polite">
      <header>
        <p v-if="view === 'success'" class="eyebrow">{{ t('PASSWORD UPDATED') }}</p>
        <h2>{{ currentHeading[0] }}</h2>
        <p>{{ currentHeading[1] }}</p>
      </header>

      <form v-if="view === 'login'" @submit.prevent="submitLogin">
        <label for="login-account">{{ t('Email or phone number') }}</label>
        <input id="login-account" v-model="loginAccount" autocomplete="username" />
        <span v-if="errors.account" class="field-error">{{ t(errors.account) }}</span>
        <label for="login-password">{{ t('Password') }}</label>
        <div class="password-field">
          <input id="login-password" v-model="loginPassword" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" />
          <button type="button" @click="showPassword = !showPassword">{{ t(showPassword ? 'Hide' : 'Show') }}</button>
        </div>
        <span v-if="errors.password" class="field-error">{{ t(errors.password) }}</span>
        <div class="auth-inline">
          <label class="check-label"><input type="checkbox" />{{ t('Remember me') }}</label>
          <button type="button" class="text-button" @click="setView('forgot')">{{ t('Forgot password?') }}</button>
        </div>
        <p class="auth-status" :data-tone="statusTone">{{ t(statusMessage) }}</p>
        <button class="auth-primary" :disabled="isSubmitting">{{ t(isSubmitting ? 'Signing in…' : 'Sign in') }}</button>
        <p class="auth-footer">{{ t('New here?') }}<button type="button" class="text-button" @click="setView('register')">{{ t('Create account') }}</button></p>
      </form>

      <form v-else-if="view === 'register'" @submit.prevent="submitRegister">
        <label for="register-name">{{ t('Display name') }}</label>
        <input id="register-name" v-model="registerName" autocomplete="nickname" />
        <span v-if="errors.name" class="field-error">{{ t(errors.name) }}</span>
        <label for="register-account">{{ t('Email or phone number') }}</label>
        <input id="register-account" v-model="registerAccount" autocomplete="username" />
        <span v-if="errors.account" class="field-error">{{ t(errors.account) }}</span>
        <label for="register-password">{{ t('Password') }}</label>
        <input id="register-password" v-model="registerPassword" type="password" autocomplete="new-password" />
        <span v-if="errors.password" class="field-error">{{ t(errors.password) }}</span>
        <label for="register-confirm">{{ t('Confirm password') }}</label>
        <input id="register-confirm" v-model="registerConfirm" type="password" autocomplete="new-password" />
        <span v-if="errors.confirm" class="field-error">{{ t(errors.confirm) }}</span>
        <label class="check-label agreement"><input v-model="registerAgreed" type="checkbox" />{{ t('I agree to the Terms of Service and Privacy Policy') }}</label>
        <span v-if="errors.agreed" class="field-error">{{ t(errors.agreed) }}</span>
        <p class="auth-status" :data-tone="statusTone">{{ t(statusMessage) }}</p>
        <button class="auth-primary" :disabled="isSubmitting">{{ t(isSubmitting ? 'Creating…' : 'Create account') }}</button>
        <p class="auth-footer">{{ t('Already have an account?') }}<button type="button" class="text-button" @click="setView('login')">{{ t('Back to sign in') }}</button></p>
      </form>

      <form v-else-if="view === 'forgot'" @submit.prevent="submitRecovery">
        <label for="recovery-account">{{ t('Email or phone number') }}</label>
        <input id="recovery-account" v-model="recoveryAccount" autocomplete="username" />
        <span v-if="errors.account" class="field-error">{{ t(errors.account) }}</span>
        <div class="code-row">
          <div><label for="recovery-code">{{ t('Verification code') }}</label><input id="recovery-code" v-model="recoveryCode" inputmode="numeric" /></div>
          <button type="button" @click="sendCode">{{ t('Send code') }}</button>
        </div>
        <span v-if="errors.code" class="field-error">{{ t(errors.code) }}</span>
        <p class="auth-status" :data-tone="statusTone">{{ t(statusMessage) }}</p>
        <button class="auth-primary">{{ t('Continue') }}</button>
        <p class="auth-footer"><button type="button" class="text-button" @click="setView('login')">{{ t('Back to sign in') }}</button></p>
      </form>

      <form v-else-if="view === 'reset'" @submit.prevent="submitReset">
        <label for="reset-password">{{ t('New password') }}</label>
        <input id="reset-password" v-model="resetPassword" type="password" autocomplete="new-password" />
        <span v-if="errors.password" class="field-error">{{ t(errors.password) }}</span>
        <label for="reset-confirm">{{ t('Confirm new password') }}</label>
        <input id="reset-confirm" v-model="resetConfirm" type="password" autocomplete="new-password" />
        <span v-if="errors.confirm" class="field-error">{{ t(errors.confirm) }}</span>
        <button class="auth-primary">{{ t('Reset password') }}</button>
      </form>

      <div v-else class="success-state">
        <span aria-hidden="true">✓</span>
        <button class="auth-primary" type="button" @click="setView('login')">{{ t('Back to sign in') }}</button>
      </div>

      <p class="privacy-note">{{ t('Your financial data belongs to you. We never use it for advertising.') }}</p>
    </section>
  </main>
</template>

<style scoped>
.auth-language-switch{position:fixed;top:42px;right:42px;z-index:5;display:flex;padding:3px;border:1px solid #d7d6cf;border-radius:10px;background:rgba(255,253,248,.92);box-shadow:0 6px 20px rgba(25,42,33,.08)}.auth-language-switch button{padding:7px 10px;border:0;border-radius:7px;color:#6a746d;background:transparent;cursor:pointer;font-size:.75rem;font-weight:800}.auth-language-switch button.active{color:#fff;background:#2d6049}@media(max-width:760px){.auth-language-switch{top:18px;right:18px}}
.auth-shell{min-height:100vh;display:grid;grid-template-columns:minmax(360px,1.05fr) minmax(420px,.95fr);padding:28px;background:#f1eee7}.auth-brand-panel,.auth-card{border:1px solid rgba(42,53,43,.12)}.auth-brand-panel{display:flex;min-height:calc(100vh - 56px);flex-direction:column;padding:48px;border-radius:28px 0 0 28px;color:#f8f5ed;background:#243c31;overflow:hidden}.auth-brand{display:flex;align-items:center;gap:13px}.auth-brand>span{display:grid;width:46px;height:46px;place-items:center;border-radius:14px;color:#243c31;background:#f6c85f;font-weight:900}.auth-brand strong,.auth-brand small{display:block}.auth-brand small{margin-top:2px;color:#c5d0c8}.auth-copy{margin:auto 0}.auth-copy h1{max-width:600px;margin:12px 0 18px;font-family:Georgia,serif;font-size:clamp(2.5rem,5vw,5.4rem);font-weight:500;line-height:1.02}.auth-copy>p:last-child{max-width:450px;color:#d2dbd4;font-size:1.05rem}.ledger-preview{width:min(390px,100%);padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(255,255,255,.08)}.ledger-preview div{display:flex;justify-content:space-between;padding:7px 0}.ledger-preview span,.ledger-preview small{color:#c5d0c8}.ledger-preview small{display:block;margin-top:8px}.auth-card{align-self:stretch;display:flex;flex-direction:column;justify-content:center;padding:clamp(28px,6vw,76px);border-radius:0 28px 28px 0;background:#fffdf8}.auth-card header{margin-bottom:24px}.auth-card h2{margin:0 0 8px;font-family:Georgia,serif;font-size:2rem}.auth-card header p{margin:0;color:#6f766f}.auth-card form{display:grid}.auth-card label{margin:13px 0 6px;font-size:.88rem;font-weight:750}.auth-card input:not([type=checkbox]){width:100%;height:46px;padding:0 13px;border:1px solid #d8d8d0;border-radius:11px;outline:none;background:white}.auth-card input:focus{border-color:#2f6b4f;box-shadow:0 0 0 3px rgba(47,107,79,.12)}.password-field{display:flex;border:1px solid #d8d8d0;border-radius:11px;background:white}.password-field input{border:0!important;box-shadow:none!important}.password-field button,.text-button{border:0;color:#276247;background:transparent;font-weight:700;cursor:pointer}.auth-inline{display:flex;justify-content:space-between;align-items:center;margin-top:13px}.check-label{display:flex;align-items:center;gap:8px!important;margin:0!important;font-weight:500!important}.check-label input{width:16px;height:16px}.agreement{margin-top:16px!important}.auth-status{min-height:20px;margin:17px 0 9px;color:#7b817b;font-size:.82rem}.auth-status[data-tone=success]{color:#287052}.auth-primary{width:100%;padding:13px 18px;border:0;border-radius:11px;color:white;background:#2d6049;font-weight:800;cursor:pointer}.auth-primary:disabled{cursor:wait;opacity:.65}.auth-footer{text-align:center;color:#70766f}.field-error{margin-top:5px;color:#b8413c;font-size:.8rem}.code-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}.code-row>button{height:46px;padding:0 14px;border:1px solid #2d6049;border-radius:11px;color:#2d6049;background:#f4faf6;font-weight:700}.code-row>div{display:grid}.privacy-note{margin:20px 0 0;text-align:center;color:#8a8d87;font-size:.75rem}.success-state>span{display:grid;width:54px;height:54px;margin:0 auto 24px;place-items:center;border-radius:50%;color:#fff;background:#2d6049;font-size:1.5rem}.eyebrow{color:#e8b84f!important}.auth-card .eyebrow{color:#2d6049!important}.auth-card .success-state{display:grid;gap:16px}.auth-card button:focus-visible{outline:3px solid rgba(47,107,79,.25);outline-offset:2px}@media(max-width:760px){.auth-shell{display:block;padding:0;background:#fffdf8}.auth-brand-panel{min-height:auto;padding:24px;border:0;border-radius:0}.auth-copy{margin:46px 0 20px}.auth-copy h1{font-size:2.35rem}.ledger-preview{display:none}.auth-card{min-height:60vh;padding:30px 24px 44px;border:0;border-radius:0}.auth-brand>span{width:40px;height:40px}.auth-copy>p:last-child{font-size:.95rem}}
.password-field input{flex:1;min-width:0;width:auto!important}.password-field>button{flex:0 0 auto;padding:0 14px;white-space:nowrap}
.auth-status[data-tone=error]{color:#b8413c}
</style>
