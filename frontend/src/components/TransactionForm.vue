<script setup>
import { ref } from 'vue'

const emit = defineEmits(['submit'])

const selectedType = ref(null)
const amount = ref('')
const selectedCategory = ref('')
const transactionDate = ref('')
const description = ref('')

const incomeCategories = [
  '工资',
  '奖金',
  '兼职',
  '投资收益',
  '红包',
  '退款',
  '其他收入',
]

const expenseCategories = [
  '餐饮',
  '交通',
  '购物',
  '住房',
  '娱乐',
  '医疗',
  '教育',
  '水电网络',
  '其他支出',
]

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
  if (!amount.value || amount.value <= 0) {
    alert('请输入大于 0 的金额')
    return
  }

  if (!selectedCategory.value) {
    alert('请选择分类')
    return
  }

  if (!transactionDate.value) {
    alert('请选择日期')
    return
  }

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
    <div class="panel-heading">
      <div>
        <p class="eyebrow">NEW ENTRY</p>
        <h2>记录一笔账目</h2>
      </div>
    </div>

    <div v-if="selectedType === null" class="type-selector">
      <p>请选择账目类型：</p>

      <button type="button" @click="selectType('income')">
        收入
      </button>

      <button
        type="button"
        data-test="expense-button"
        @click="selectType('expense')"
      >
        支出
      </button>
    </div>

    <form v-else @submit.prevent="submitTransaction">
      <p>
        当前类型：
        {{ selectedType === 'income' ? '收入' : '支出' }}
      </p>

      <label for="amount">金额</label>
      <input
        id="amount"
        v-model.number="amount"
        type="number"
        min="0.01"
        step="0.01"
        placeholder="请输入金额"
      />

      <label for="category">
        {{ selectedType === 'income' ? '收入来源' : '支出用途' }}
      </label>

      <select id="category" v-model="selectedCategory">
        <option disabled value="">请选择分类</option>

        <option
          v-for="category in selectedType === 'income'
            ? incomeCategories
            : expenseCategories"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>

      <label for="transaction-date">日期</label>
      <input
        id="transaction-date"
        v-model="transactionDate"
        type="date"
      />

      <label for="description">备注</label>
      <textarea
        id="description"
        v-model="description"
        placeholder="可以填写这笔账目的说明"
      ></textarea>

      <button type="submit" class="primary-button">
        保存账目
      </button>

      <button
        type="button"
        class="secondary-button"
        @click="goBack"
      >
        重新选择
      </button>
    </form>
  </section>
</template>