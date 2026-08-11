# Dashboard Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vue starter screen with a responsive accounting dashboard containing summary cards, a transaction form, and a transaction list, while preserving the working Express and SQLite data flow.

**Architecture:** `HomeView.vue` remains the data-owning page and performs GET/POST requests. Three presentational components receive data through props and communicate user actions through emits. `App.vue` becomes a small application shell so the components can later move into a sidebar layout without changing their business behavior.

**Tech Stack:** Vue 3 Composition API, Vite, Vitest, Vue Test Utils, CSS Grid, Express, SQLite

---

## File map

- Create `frontend/src/components/SummaryCards.vue`: calculate and display income, expense, and balance.
- Create `frontend/src/components/TransactionForm.vue`: collect and validate transaction input, then emit `submit`.
- Create `frontend/src/components/TransactionList.vue`: render transaction rows with income/expense styling.
- Create component tests beside each component in `frontend/src/components/__tests__/`.
- Modify `frontend/src/views/HomeView.vue`: own API data and compose the three components.
- Modify `frontend/src/App.vue`: remove Vue starter content and provide the app shell.
- Modify `frontend/src/assets/main.css`: global dashboard and responsive styling.
- Modify `frontend/src/assets/base.css`: replace the starter theme with project color tokens.

### Task 1: Preserve the working API-list checkpoint

**Files:**
- Modify: `frontend/src/views/HomeView.vue`

- [ ] **Step 1: Verify the current feature**

Run:

```bash
cd frontend
npm run lint
npm run build
```

Expected: both commands exit successfully.

- [ ] **Step 2: Commit only the completed API-list work**

```bash
cd ..
git add frontend/src/views/HomeView.vue
git commit -m "feat: display saved transactions"
```

Expected: one commit containing only `HomeView.vue`.

### Task 2: Add the frontend component-test foundation

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vite.config.js`

- [ ] **Step 1: Install the test tools**

```bash
cd frontend
npm install --save-dev vitest @vue/test-utils jsdom
```

- [ ] **Step 2: Add the test command to `package.json`**

Add inside `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Configure the test environment**

Add this property inside `defineConfig({ ... })` in `vite.config.js`:

```js
test: {
  environment: 'jsdom',
},
```

- [ ] **Step 4: Verify the test runner starts**

Run:

```bash
npm test
```

Expected: Vitest starts and reports that no test files were found. At this point a non-zero exit caused only by “No test files found” is expected.

- [ ] **Step 5: Commit the test foundation**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "test: configure Vue component tests"
```

### Task 3: Build and test the summary cards

**Files:**
- Create: `frontend/src/components/__tests__/SummaryCards.test.js`
- Create: `frontend/src/components/SummaryCards.vue`

- [ ] **Step 1: Write the failing summary test**

```js
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SummaryCards from '../SummaryCards.vue'

describe('SummaryCards', () => {
  it('calculates income, expense, and balance', () => {
    const wrapper = mount(SummaryCards, {
      props: {
        transactions: [
          { id: 1, type: 'income', amount: 100 },
          { id: 2, type: 'expense', amount: 25.5 },
        ],
      },
    })

    expect(wrapper.get('[data-test="income-total"]').text()).toContain('$100.00')
    expect(wrapper.get('[data-test="expense-total"]').text()).toContain('$25.50')
    expect(wrapper.get('[data-test="balance-total"]').text()).toContain('$74.50')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run src/components/__tests__/SummaryCards.test.js
```

Expected: FAIL because `SummaryCards.vue` does not exist.

- [ ] **Step 3: Implement `SummaryCards.vue`**

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({
  transactions: {
    type: Array,
    required: true,
  },
})

const incomeTotal = computed(() =>
  props.transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + Number(transaction.amount), 0),
)

const expenseTotal = computed(() =>
  props.transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + Number(transaction.amount), 0),
)

const balance = computed(() => incomeTotal.value - expenseTotal.value)

function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`
}
</script>

<template>
  <section class="summary-grid" aria-label="账目汇总">
    <article class="summary-card summary-card--income">
      <span>总收入</span>
      <strong data-test="income-total">{{ formatCurrency(incomeTotal) }}</strong>
    </article>
    <article class="summary-card summary-card--expense">
      <span>总支出</span>
      <strong data-test="expense-total">{{ formatCurrency(expenseTotal) }}</strong>
    </article>
    <article class="summary-card">
      <span>当前结余</span>
      <strong data-test="balance-total">{{ formatCurrency(balance) }}</strong>
    </article>
  </section>
</template>
```

- [ ] **Step 4: Run the test and commit**

```bash
npx vitest run src/components/__tests__/SummaryCards.test.js
git add src/components/SummaryCards.vue src/components/__tests__/SummaryCards.test.js
git commit -m "feat: add transaction summary cards"
```

Expected: 1 test passes.

### Task 4: Extract and test the transaction list

**Files:**
- Create: `frontend/src/components/__tests__/TransactionList.test.js`
- Create: `frontend/src/components/TransactionList.vue`

- [ ] **Step 1: Write the failing list test**

```js
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TransactionList from '../TransactionList.vue'

describe('TransactionList', () => {
  it('renders income and expense rows', () => {
    const wrapper = mount(TransactionList, {
      props: {
        transactions: [
          { id: 1, type: 'income', amount: 12, category: '兼职', transactionDate: '2026-08-10', description: '' },
          { id: 2, type: 'expense', amount: 25.5, category: '餐饮', transactionDate: '2026-08-09', description: '早餐' },
        ],
      },
    })

    expect(wrapper.findAll('[data-test="transaction-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('兼职')
    expect(wrapper.text()).toContain('早餐')
    expect(wrapper.get('.transaction-amount--income').text()).toBe('+$12.00')
    expect(wrapper.get('.transaction-amount--expense').text()).toBe('-$25.50')
  })
})
```

- [ ] **Step 2: Run it and confirm the missing-component failure**

```bash
npx vitest run src/components/__tests__/TransactionList.test.js
```

- [ ] **Step 3: Implement `TransactionList.vue`**

```vue
<script setup>
defineProps({
  transactions: {
    type: Array,
    required: true,
  },
})

function formatAmount(transaction) {
  const sign = transaction.type === 'income' ? '+' : '-'
  return `${sign}$${Number(transaction.amount).toFixed(2)}`
}
</script>

<template>
  <section class="panel transaction-list">
    <div class="panel-heading">
      <div><p class="eyebrow">TRANSACTIONS</p><h2>账目记录</h2></div>
      <span>{{ transactions.length }} 笔</span>
    </div>
    <p v-if="transactions.length === 0" class="empty-state">目前还没有账目</p>
    <ul v-else>
      <li v-for="transaction in transactions" :key="transaction.id" data-test="transaction-row" class="transaction-row">
        <div><strong>{{ transaction.category }}</strong><p>{{ transaction.transactionDate }} · {{ transaction.description || '无备注' }}</p></div>
        <span :class="`transaction-amount transaction-amount--${transaction.type}`">{{ formatAmount(transaction) }}</span>
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 4: Run the test and commit**

```bash
npx vitest run src/components/__tests__/TransactionList.test.js
git add src/components/TransactionList.vue src/components/__tests__/TransactionList.test.js
git commit -m "feat: add transaction list component"
```

### Task 5: Extract and test the transaction form

**Files:**
- Create: `frontend/src/components/__tests__/TransactionForm.test.js`
- Create: `frontend/src/components/TransactionForm.vue`

- [ ] **Step 1: Write the failing form test**

```js
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TransactionForm from '../TransactionForm.vue'

describe('TransactionForm', () => {
  it('emits a complete expense transaction', async () => {
    const wrapper = mount(TransactionForm)
    await wrapper.get('[data-test="expense-button"]').trigger('click')
    await wrapper.get('#amount').setValue('18.75')
    await wrapper.get('#category').setValue('餐饮')
    await wrapper.get('#transaction-date').setValue('2026-08-10')
    await wrapper.get('#description').setValue('午餐')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')[0][0]).toEqual({
      type: 'expense', amount: 18.75, category: '餐饮', transactionDate: '2026-08-10', description: '午餐',
    })
  })
})
```

- [ ] **Step 2: Run it and confirm the missing-component failure**

```bash
npx vitest run src/components/__tests__/TransactionForm.test.js
```

- [ ] **Step 3: Implement `TransactionForm.vue`**

```vue
<script setup>
import { ref } from 'vue'

const emit = defineEmits(['submit'])
const selectedType = ref(null)
const amount = ref('')
const selectedCategory = ref('')
const transactionDate = ref('')
const description = ref('')
const incomeCategories = ['工资', '奖金', '兼职', '投资收益', '红包', '退款', '其他收入']
const expenseCategories = ['餐饮', '交通', '购物', '住房', '娱乐', '医疗', '教育', '水电网络', '其他支出']

function resetFields() {
  amount.value = ''
  selectedCategory.value = ''
  transactionDate.value = ''
  description.value = ''
}

function selectType(type) {
  selectedType.value = type
  resetFields()
}

function goBack() {
  selectedType.value = null
  resetFields()
}

function submitTransaction() {
  if (!amount.value || amount.value <= 0) return alert('请输入大于 0 的金额')
  if (!selectedCategory.value) return alert('请选择分类')
  if (!transactionDate.value) return alert('请选择日期')

  emit('submit', {
    type: selectedType.value,
    amount: Number(amount.value),
    category: selectedCategory.value,
    transactionDate: transactionDate.value,
    description: description.value,
  })
}
</script>

<template>
  <section class="panel transaction-form">
    <div class="panel-heading"><div><p class="eyebrow">NEW ENTRY</p><h2>记录一笔账目</h2></div></div>
    <div v-if="selectedType === null" class="type-selector">
      <p>请选择账目类型：</p>
      <button type="button" @click="selectType('income')">收入</button>
      <button type="button" data-test="expense-button" @click="selectType('expense')">支出</button>
    </div>
    <form v-else @submit.prevent="submitTransaction">
      <p>当前类型：{{ selectedType === 'income' ? '收入' : '支出' }}</p>
      <label for="amount">金额</label>
      <input id="amount" v-model.number="amount" type="number" min="0.01" step="0.01" placeholder="请输入金额" />
      <label for="category">{{ selectedType === 'income' ? '收入来源' : '支出用途' }}</label>
      <select id="category" v-model="selectedCategory">
        <option disabled value="">请选择分类</option>
        <option v-for="category in selectedType === 'income' ? incomeCategories : expenseCategories" :key="category" :value="category">{{ category }}</option>
      </select>
      <label for="transaction-date">日期</label>
      <input id="transaction-date" v-model="transactionDate" type="date" />
      <label for="description">备注</label>
      <textarea id="description" v-model="description" placeholder="可以填写这笔账目的说明"></textarea>
      <button type="submit" class="primary-button">保存账目</button>
      <button type="button" class="secondary-button" @click="goBack">重新选择</button>
    </form>
  </section>
</template>
```

- [ ] **Step 4: Run the test and commit**

```bash
npx vitest run src/components/__tests__/TransactionForm.test.js
git add src/components/TransactionForm.vue src/components/__tests__/TransactionForm.test.js
git commit -m "feat: extract transaction form component"
```

Expected: the form test passes and its emitted object exactly matches the test.

### Task 6: Compose the dashboard in HomeView

**Files:**
- Modify: `frontend/src/views/HomeView.vue`

- [ ] **Step 1: Replace form state with component imports**

Keep `transactions`, `savedTransaction`, `loadTransactions()`, and `onMounted()`. Import:

```js
import SummaryCards from '@/components/SummaryCards.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import TransactionList from '@/components/TransactionList.vue'
```

Change `saveTransaction` to accept the emitted object:

```js
async function saveTransaction(transaction) {
  try {
    const response = await fetch('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    })
    const result = await response.json()
    if (!response.ok) return alert(result.message || '保存失败')
    savedTransaction.value = result.transaction
    await loadTransactions()
  } catch (error) {
    console.error(error)
    alert('无法连接后端服务器')
  }
}
```

- [ ] **Step 2: Replace the template with the dashboard composition**

```vue
<template>
  <main class="dashboard">
    <section class="page-heading">
      <div><p class="eyebrow">PERSONAL FINANCE</p><h1>我的账本</h1></div>
      <p>清楚记录每一笔收入与支出。</p>
    </section>
    <SummaryCards :transactions="transactions" />
    <section class="dashboard-grid">
      <TransactionForm @submit="saveTransaction" />
      <TransactionList :transactions="transactions" />
    </section>
  </main>
</template>
```

- [ ] **Step 3: Run all component tests**

```bash
npm test
```

Expected: all three test files pass.

- [ ] **Step 4: Commit the composed page**

```bash
git add src/views/HomeView.vue
git commit -m "refactor: compose accounting dashboard"
```

### Task 7: Replace the Vue starter shell and add responsive styling

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/assets/base.css`
- Modify: `frontend/src/assets/main.css`
- Modify: `frontend/src/router/index.js`

- [ ] **Step 1: Simplify `App.vue`**

```vue
<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>
```

- [ ] **Step 2: Remove the unused About route**

Keep only the `/` route in `src/router/index.js`. Do not delete `AboutView.vue` in this task; removing unused starter files can happen in a later cleanup.

- [ ] **Step 3: Replace starter theme rules**

Define project tokens in `base.css`:

```css
:root {
  --page-bg: #f4f7f5;
  --surface: #ffffff;
  --text: #17231d;
  --muted: #66736c;
  --border: #dfe7e2;
  --primary: #197149;
  --primary-dark: #115739;
  --income: #16865a;
  --expense: #c44747;
  --shadow: 0 12px 32px rgba(23, 35, 29, 0.08);
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; color: var(--text); background: var(--page-bg); font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input, select, textarea { font: inherit; }
```

Add the layout rules in `main.css`:

```css
@import './base.css';
#app { min-height: 100vh; }
.dashboard { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0; }
.page-heading { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 24px; }
.page-heading h1, .panel h2 { margin: 0; }
.eyebrow { margin: 0 0 6px; color: var(--primary); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.summary-card, .panel { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: var(--shadow); }
.summary-card { padding: 20px; }
.summary-card span { display: block; color: var(--muted); }
.summary-card strong { display: block; margin-top: 6px; font-size: 1.6rem; }
.summary-card--income strong, .transaction-amount--income { color: var(--income); }
.summary-card--expense strong, .transaction-amount--expense { color: var(--expense); }
.dashboard-grid { display: grid; grid-template-columns: minmax(280px, 0.85fr) minmax(360px, 1.15fr); gap: 20px; align-items: start; }
.panel { padding: 24px; }
.panel-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.transaction-list ul { list-style: none; margin: 0; padding: 0; }
.transaction-row { display: flex; justify-content: space-between; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--border); }
.transaction-row p { margin: 4px 0 0; color: var(--muted); }
.transaction-amount { font-weight: 700; white-space: nowrap; }
label { display: block; margin: 14px 0 6px; font-weight: 600; }
input, select, textarea { width: 100%; padding: 11px 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); }
textarea { min-height: 88px; resize: vertical; }
.primary-button, .secondary-button { margin-top: 16px; padding: 11px 16px; border-radius: 9px; cursor: pointer; }
.primary-button { border: 0; background: var(--primary); color: white; }
.primary-button:hover { background: var(--primary-dark); }
.secondary-button { margin-left: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
@media (max-width: 760px) {
  .dashboard { width: min(100% - 24px, 620px); padding: 28px 0; }
  .page-heading { display: block; }
  .summary-grid, .dashboard-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Run complete verification**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, lint exits successfully, and Vite reports a successful build.

- [ ] **Step 5: Manually verify the two responsive states**

Run `npm run dev`. At desktop width, confirm three summary cards and the form/list double column. Narrow the browser below 760px and confirm all sections stack without horizontal scrolling. Submit one income and one expense and confirm the list and totals update immediately.

- [ ] **Step 6: Commit the dashboard styling**

```bash
git add src/App.vue src/assets/base.css src/assets/main.css src/router/index.js
git commit -m "feat: style responsive accounting dashboard"
```
