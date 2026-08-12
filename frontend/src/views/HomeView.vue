<script setup>
import { onMounted, ref } from 'vue'

import SummaryCards from '@/components/SummaryCards.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import TransactionList from '@/components/TransactionList.vue'

const transactions = ref([])
const editingTransaction = ref(null)

async function loadTransactions() {
  try {
    const response = await fetch(
      'http://localhost:3000/api/transactions',
    )

    if (!response.ok) {
      throw new Error('读取账目失败')
    }

    transactions.value = await response.json()
  } catch (error) {
    console.error(error)
    alert('无法读取账目列表')
  }
}

async function saveTransaction(transaction) {
  try {
    const response = await fetch(
      'http://localhost:3000/api/transactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transaction),
      },
    )

    const result = await response.json()

    if (!response.ok) {
      alert(result.message || '保存失败')
      return
    }

    await loadTransactions()
    alert('账目已经保存到数据库')
  } catch (error) {
    console.error(error)
    alert('无法连接后端服务器')
  }
}

async function updateTransaction(transaction) {
  const transactionId = editingTransaction.value.id

  try {
    const response = await fetch(
      `http://localhost:3000/api/transactions/${transactionId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transaction),
      },
    )

    const result = await response.json()

    if (!response.ok) {
      alert(result.message || '修改失败')
      return
    }

    editingTransaction.value = null
    await loadTransactions()
    alert('账目修改成功')
  } catch (error) {
    console.error(error)
    alert('无法连接后端服务器')
  }
}

async function submitTransaction(transaction) {
  if (editingTransaction.value) {
    await updateTransaction(transaction)
    return
  }

  await saveTransaction(transaction)
}

function startEditing(transaction) {
  editingTransaction.value = { ...transaction }
}

function cancelEditing() {
  editingTransaction.value = null
}

async function deleteTransaction(transactionId) {
  const shouldDelete = window.confirm(
    '确定要删除这笔账目吗？此操作无法撤销。',
  )

  if (!shouldDelete) {
    return
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/transactions/${transactionId}`,
      {
        method: 'DELETE',
      },
    )

    const result = await response.json()

    if (!response.ok) {
      alert(result.message || '删除失败')
      return
    }

    await loadTransactions()

    if (editingTransaction.value?.id === transactionId) {
      editingTransaction.value = null
    }

    alert('账目已经删除')
  } catch (error) {
    console.error(error)
    alert('无法连接后端服务器')
  }
}

onMounted(() => {
  loadTransactions()
})
</script>

<template>
  <main class="dashboard">
    <section class="page-heading">
      <div>
        <p class="eyebrow">PERSONAL FINANCE</p>
        <h1>我的账本</h1>
      </div>

      <p>清楚记录每一笔收入与支出。</p>
    </section>

    <SummaryCards :transactions="transactions" />

    <section class="dashboard-grid">
      <TransactionForm
        :editing-transaction="editingTransaction"
        @submit="submitTransaction"
        @cancel="cancelEditing"
      />

      <TransactionList
        :transactions="transactions"
        @edit="startEditing"
        @delete="deleteTransaction"
      />
    </section>
  </main>
</template>
