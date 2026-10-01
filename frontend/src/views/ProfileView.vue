<script setup>
import { computed, inject, ref } from 'vue'
import { useI18n } from '@/i18n'
import { apiRequest } from '@/services/apiClient'

const { language, setLanguage, t } = useI18n()

const authContext = inject('authContext', {
  user: ref({ name: 'Ledger User', account: '' }),
  logout: () => {},
  updateUser: () => {},
})

const profileName = ref(authContext.user.value.name)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const profileStatus = ref({ tone: 'neutral', message: '' })
const passwordStatus = ref({ tone: 'neutral', message: '' })
const isSavingProfile = ref(false)
const isChangingPassword = ref(false)
const showLogoutConfirmation = ref(false)

const avatarText = computed(() => authContext.user.value.name.slice(0, 1))
const accountType = computed(() =>
  t(authContext.user.value.account.includes('@') ? 'Email account' : 'Phone account'),
)

function requestError(error) {
  return error.message === 'Failed to fetch'
    ? t('Cannot connect to the server. Make sure the backend is running.')
    : t(error.message)
}

async function saveProfile() {
  const name = profileName.value.trim()
  if (!name || name.length > 40) {
    profileStatus.value = {
      tone: 'error',
      message: t('Display name must be 1 to 40 characters'),
    }
    return
  }

  isSavingProfile.value = true
  profileStatus.value = { tone: 'neutral', message: t('Saving…') }
  try {
    const result = await apiRequest('/api/account/profile', {
      method: 'PATCH',
      body: { name },
      fallbackMessage: 'Could not save',
    })
    authContext.updateUser(result.user)
    profileName.value = result.user.name
    profileStatus.value = { tone: 'success', message: t('Display name saved') }
  } catch (error) {
    profileStatus.value = { tone: 'error', message: requestError(error) }
  } finally {
    isSavingProfile.value = false
  }
}

function validateNewPassword() {
  if (!currentPassword.value) return t('Enter your current password')
  if (newPassword.value.length < 8) return t('New password must be at least 8 characters')
  if (!/[a-zA-Z]/.test(newPassword.value) || !/\d/.test(newPassword.value)) {
    return t('New password must include letters and numbers')
  }
  if (newPassword.value === currentPassword.value) {
    return t('New password must differ from the current password')
  }
  if (confirmPassword.value !== newPassword.value) return t('New passwords do not match')
  return ''
}

async function changePassword() {
  const validationMessage = validateNewPassword()
  if (validationMessage) {
    passwordStatus.value = { tone: 'error', message: validationMessage }
    return
  }

  isChangingPassword.value = true
  passwordStatus.value = { tone: 'neutral', message: t('Updating password…') }
  try {
    await apiRequest('/api/account/password', {
      method: 'PUT',
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      },
      fallbackMessage: 'Could not change the password',
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordStatus.value = {
      tone: 'success',
      message: t('Password updated. Returning to sign in…'),
    }
    window.setTimeout(() => authContext.logout(), 900)
  } catch (error) {
    passwordStatus.value = { tone: 'error', message: requestError(error) }
  } finally {
    isChangingPassword.value = false
  }
}

function confirmLogout() {
  showLogoutConfirmation.value = false
  authContext.logout()
}
</script>

<template>
  <main class="profile-page">
    <header class="profile-heading">
      <p class="eyebrow">{{ t('MY ACCOUNT') }}</p>
      <h1>{{ t('My Profile') }}</h1>
      <p>{{ t('Manage your personal information, password, and account security.') }}</p>
    </header>

    <section class="profile-hero">
      <span class="profile-avatar">{{ avatarText }}</span>
      <div>
        <small>{{ t('Signed-in user') }}</small>
        <h2>{{ authContext.user.value.name }}</h2>
        <p>{{ authContext.user.value.account }}</p>
      </div>
      <span class="account-state"><i></i>{{ t('Account active') }}</span>
    </section>

    <section class="profile-grid">
      <article class="profile-panel">
        <div class="profile-panel-heading">
          <div><p class="eyebrow">{{ t('PROFILE') }}</p><h2>{{ t('Basic Information') }}</h2></div>
          <span>{{ t('Editable') }}</span>
        </div>
        <form class="profile-form" @submit.prevent="saveProfile">
          <label for="profile-name">{{ t('Display name') }}</label>
          <input id="profile-name" v-model="profileName" maxlength="40" autocomplete="nickname" />
          <small>{{ t('Your display name appears in the sidebar and does not change your login.') }}</small>
          <label for="profile-account">{{ accountType }}</label>
          <input id="profile-account" :value="authContext.user.value.account" disabled />
          <small>{{ t('Your login identifier cannot currently be changed for security reasons.') }}</small>
          <p class="form-status" :data-tone="profileStatus.tone" aria-live="polite">{{ profileStatus.message }}</p>
          <button class="primary-button" :disabled="isSavingProfile">
            {{ t(isSavingProfile ? 'Saving…' : 'Save profile') }}
          </button>
        </form>
      </article>

      <article class="profile-panel">
        <div class="profile-panel-heading">
          <div><p class="eyebrow">{{ t('SECURITY') }}</p><h2>{{ t('Change Password') }}</h2></div>
          <span>{{ t('Security check') }}</span>
        </div>
        <form class="profile-form" @submit.prevent="changePassword">
          <label for="current-password">{{ t('Current password') }}</label>
          <input id="current-password" v-model="currentPassword" type="password" autocomplete="current-password" />
          <label for="new-password">{{ t('New password') }}</label>
          <input id="new-password" v-model="newPassword" type="password" autocomplete="new-password" />
          <small>{{ t('Use at least 8 characters with both letters and numbers.') }}</small>
          <label for="confirm-password">{{ t('Confirm new password') }}</label>
          <input id="confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" />
          <p class="form-status" :data-tone="passwordStatus.tone" aria-live="polite">{{ passwordStatus.message }}</p>
          <button class="primary-button" :disabled="isChangingPassword">
            {{ t(isChangingPassword ? 'Updating…' : 'Change Password') }}
          </button>
        </form>
      </article>
    </section>

    <section class="language-panel" aria-labelledby="language-title">
      <div class="language-copy">
        <p class="eyebrow">{{ t('SETTINGS') }}</p>
        <h2 id="language-title">{{ t('Language') }}</h2>
        <p>{{ t('Choose the language used throughout this device.') }}</p>
      </div>
      <div class="language-options" role="group" :aria-label="t('Language')">
        <button type="button" :class="{ active: language === 'en' }" :aria-pressed="language === 'en'" @click="setLanguage('en')">
          <span>EN</span><strong>{{ t('English') }}</strong>
        </button>
        <button type="button" :class="{ active: language === 'zh' }" :aria-pressed="language === 'zh'" @click="setLanguage('zh')">
          <span>中</span><strong>{{ t('Chinese') }}</strong>
        </button>
      </div>
      <small>{{ t('Language preference is saved on this device and also applies to the sign-in page.') }}</small>
    </section>

    <section class="privacy-panel">
      <div class="privacy-heading"><p class="eyebrow">{{ t('PRIVACY') }}</p><h2>{{ t('Data & Privacy') }}</h2></div>
      <ul class="privacy-list">
        <li><span>01</span><p><strong>{{ t('Transactions are isolated by account') }}</strong>{{ t('Other users cannot view, edit, or delete your transactions.') }}</p></li>
        <li><span>02</span><p><strong>{{ t('Passwords are never stored as plain text') }}</strong>{{ t('Passwords are salted and hashed before being stored.') }}</p></li>
        <li><span>03</span><p><strong>{{ t('Changing your password clears old sessions') }}</strong>{{ t('After an update, you must sign in again and other devices are signed out.') }}</p></li>
      </ul>
    </section>

    <section class="logout-panel">
      <div><strong>{{ t('Sign out of this account') }}</strong><p>{{ t('Signing out does not delete transactions or personal data.') }}</p></div>
      <button type="button" @click="showLogoutConfirmation = true">{{ t('Sign out') }}</button>
    </section>

    <div v-if="showLogoutConfirmation" class="dialog-backdrop" @click.self="showLogoutConfirmation = false">
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title">
        <span aria-hidden="true">↗</span>
        <h2 id="logout-title">{{ t('Sign out?') }}</h2>
        <p>{{ t('Your transactions are saved to this account and will be here next time.') }}</p>
        <div>
          <button type="button" @click="showLogoutConfirmation = false">{{ t('Cancel') }}</button>
          <button type="button" class="danger-button" @click="confirmLogout">{{ t('Sign out') }}</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.language-panel{display:grid;grid-template-columns:minmax(230px,1fr) auto;align-items:center;gap:20px;margin-top:18px;padding:25px;border:1px solid #d8d7ce;border-radius:20px;background:#fffdf8}.language-copy h2{margin:4px 0 8px;font-family:Georgia,serif;font-size:1.55rem;font-weight:500}.language-copy>p:last-child,.language-panel>small{margin:0;color:#68736c;font-size:.82rem}.language-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}.language-options button{display:flex;min-width:132px;align-items:center;gap:9px;padding:10px 13px;border:1px solid #d8d7ce;border-radius:11px;color:#536159;background:#fff;cursor:pointer}.language-options button.active{border-color:#2d6049;color:#20352b;background:#eaf3ed;box-shadow:0 0 0 2px rgba(45,96,73,.08)}.language-options span{display:grid;width:28px;height:28px;place-items:center;border-radius:8px;background:#efede7;font-size:.75rem}.language-options .active span{color:#fff;background:#2d6049}.language-panel>small{grid-column:1/-1;padding-top:10px;border-top:1px solid #e5e2da}@media(max-width:760px){.language-panel{grid-template-columns:1fr}.language-options button{min-width:0}}
.profile-page{width:min(1080px,calc(100% - 60px));margin:0 auto;padding:64px 0 80px;color:#20352b}.profile-heading{margin-bottom:30px}.profile-heading h1{margin:8px 0;font-family:Georgia,serif;font-size:clamp(3.2rem,7vw,6rem);font-weight:500;line-height:1}.profile-heading>p:last-child{color:#68736c}.eyebrow{margin:0;color:#2d6049;font-size:.72rem;font-weight:850;letter-spacing:.18em}.profile-hero{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;padding:26px;border:1px solid #d8d7ce;border-radius:22px;background:#fffdf8}.profile-avatar{display:grid;width:74px;height:74px;place-items:center;border-radius:50%;color:#233c31;background:#f2c45f;font-family:Georgia,serif;font-size:2rem}.profile-hero small,.profile-hero p{color:#748078}.profile-hero h2,.profile-hero p{margin:3px 0}.profile-hero h2{font-family:Georgia,serif;font-size:1.8rem;font-weight:500}.account-state{display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:99px;color:#286247;background:#e8f2ec;font-size:.78rem;font-weight:800}.account-state i{width:7px;height:7px;border-radius:50%;background:#38835e}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.profile-panel,.privacy-panel{padding:25px;border:1px solid #d8d7ce;border-radius:20px;background:#fffdf8}.profile-panel-heading{display:flex;align-items:flex-start;justify-content:space-between}.profile-panel-heading h2,.privacy-heading h2{margin:4px 0 18px;font-family:Georgia,serif;font-size:1.55rem;font-weight:500}.profile-panel-heading>span{padding:6px 9px;border-radius:99px;color:#617069;background:#f0eee8;font-size:.7rem;font-weight:750}.profile-form{display:grid}.profile-form label{margin:12px 0 6px;font-size:.84rem;font-weight:800}.profile-form input{width:100%;height:44px;padding:0 12px;border:1px solid #d9d8d0;border-radius:10px;outline:none;background:#fff}.profile-form input:focus{border-color:#2d6049;box-shadow:0 0 0 3px rgba(45,96,73,.11)}.profile-form input:disabled{color:#7d837e;background:#f3f1ec}.profile-form>small{margin-top:5px;color:#878d87;font-size:.72rem}.form-status{min-height:19px;margin:14px 0 7px;color:#777f79;font-size:.79rem}.form-status[data-tone=success]{color:#287052}.form-status[data-tone=error]{color:#b8413c}.primary-button{padding:12px 15px;border:0;border-radius:10px;color:#fff;background:#2d6049;font-weight:800;cursor:pointer}.primary-button:disabled{cursor:wait;opacity:.6}.privacy-panel{margin-top:18px}.privacy-list{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:0;padding:0;list-style:none}.privacy-list li{display:grid;grid-template-columns:auto 1fr;gap:10px;padding-top:13px;border-top:1px solid #e5e2da}.privacy-list li>span{color:#2d6049;font-size:.72rem;font-weight:850}.privacy-list p{margin:0;color:#68736c;font-size:.82rem;line-height:1.55}.privacy-list strong{display:block;color:#20352b}.logout-panel{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:18px;padding:22px 25px;border:1px solid #e5c9c6;border-radius:18px;background:#fff9f7}.logout-panel p{margin:4px 0 0;color:#7a716e;font-size:.85rem}.logout-panel button{padding:11px 16px;border:1px solid #c6534b;border-radius:10px;color:#b8413c;background:#fff;font-weight:800;cursor:pointer}.dialog-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(24,35,29,.48);backdrop-filter:blur(4px)}.confirm-dialog{width:min(420px,100%);padding:28px;border-radius:20px;background:#fffdf8;box-shadow:0 24px 70px rgba(20,35,27,.28);text-align:center}.confirm-dialog>span{display:grid;width:48px;height:48px;margin:0 auto 15px;place-items:center;border-radius:50%;color:#a33d38;background:#f9e6e3;font-size:1.3rem}.confirm-dialog h2{margin:0;font-family:Georgia,serif;font-weight:500}.confirm-dialog p{margin:10px 0 22px;color:#707870;font-size:.88rem;line-height:1.6}.confirm-dialog>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.confirm-dialog button{padding:11px;border:1px solid #d7d5ce;border-radius:10px;background:#fff;cursor:pointer;font-weight:750}.confirm-dialog .danger-button{border-color:#bd4a44;color:#fff;background:#bd4a44}@media(max-width:760px){.profile-page{width:calc(100% - 28px);padding:34px 0}.profile-heading h1{font-size:3.3rem}.profile-hero{grid-template-columns:auto 1fr}.account-state{grid-column:2;justify-self:start}.profile-grid,.privacy-list{grid-template-columns:1fr}.logout-panel{align-items:flex-start;flex-direction:column}.logout-panel button{width:100%}}
</style>
