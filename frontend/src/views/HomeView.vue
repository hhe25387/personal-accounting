<script setup>
import { ref } from 'vue'

const selectedType = ref(null)
const amount = ref('')
const selectedCategory = ref('')
const transactionDate = ref('')
const description = ref('')
const savedTransaction = ref(null)

const incomeCategories = ['工资', '奖金', '兼职', '投资收益', '红包', '退款', '其他收入']

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

function selectType(type) {
  selectedType.value = type
  amount.value = ''
  selectedCategory.value = ''
  transactionDate.value = ''
  description.value = ''
}

function goBack() {
  selectedType.value = null
  amount.value = ''
  selectedCategory.value = ''
  transactionDate.value = ''
  description.value = ''
}

function saveTransaction() {
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

  savedTransaction.value = {
    type: selectedType.value,
    amount: amount.value,
    category: selectedCategory.value,
    transactionDate: transactionDate.value,
    description: description.value,
  }
}

</script>

<template>
  <main>
    <h2>记录一笔账目</h2>

    <section v-if="selectedType === null">
      <p>请选择账目类型：</p>

      <button @click="selectType('income')">收入</button>
      <button @click="selectType('expense')">支出</button>
    </section>

    <section v-else>
      <p>
        当前类型：
        {{ selectedType === 'income' ? '收入' : '支出' }}
      </p>

      <label for="amount">金额</label>

      <input id="amount" v-model.number="amount" type="number" min="0.01" step="0.01" placeholder="请输入金额" />

      <label for="category">
        {{ selectedType === 'income' ? '收入来源' : '支出用途' }}
      </label>

      <select id="category" v-model="selectedCategory">
        <option disabled value="">请选择分类</option>

        <option v-for="category in selectedType === 'income' ? incomeCategories : expenseCategories" :key="category"
          :value="category">
          {{ category }}
        </option>
      </select>

      <label for="transaction-date">日期</label>

      <input id="transaction-date" v-model="transactionDate" type="date" />

      <label for="description">备注</label>

      <textarea id="description" v-model="description" placeholder="可以填写这笔账目的说明"></textarea>

      <p>用户输入的金额：{{ amount }} 美元</p>
      <p>当前分类：{{ selectedCategory }}</p>
      <p>账目日期：{{ transactionDate }}</p>
      <p>账目备注：{{ description }}</p>

      <button @click="saveTransaction">保存账目</button>
      <button @click="goBack">返回重新选择</button>

    </section>

    <section v-if="savedTransaction">
      <h3>准备保存的账目</h3>
      <pre>{{ savedTransaction }}</pre>
    </section>
  </main>
</template>