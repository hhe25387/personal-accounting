import { expect, test } from '@playwright/test'

test('新用户可以注册、记录支出并在账目页查看', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByRole('button', { name: 'Create account' }).click()

  await page.getByLabel('Display name').fill('E2E Ledger User')
  await page.getByLabel('Email or phone number').fill('e2e-ledger@example.com')
  await page.getByLabel('Password', { exact: true }).fill('testing123')
  await page.getByLabel('Confirm password').fill('testing123')
  await page.getByLabel('I agree to the Terms of Service and Privacy Policy').check()
  await page.getByRole('button', { name: 'Create account', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Quick Entry' })).toBeVisible()
  await page.getByLabel('How much did you spend?').fill('42.50')
  await page.getByRole('button', { name: 'Dining', exact: true }).click()
  await page.getByLabel('Note (optional)').fill('E2E team lunch')

  const savedTransaction = page.waitForResponse((response) =>
    response.url().endsWith('/api/transactions') &&
    response.request().method() === 'POST' &&
    response.status() === 201,
  )
  await page.getByRole('button', { name: 'Save expense' }).click()
  await savedTransaction
  await expect(page.getByRole('status')).toContainText('Recorded ¥42.50 Dining')

  await page.getByRole('link', { name: 'Transactions', exact: true }).click()

  await expect(page).toHaveURL(/\/records$/)
  await expect(page.getByText('E2E team lunch')).toBeVisible()
  await expect(page.getByText('-¥42.50')).toBeVisible()

  await page.getByRole('link', { name: 'Monthly Overview', exact: true }).click()

  await expect(page).toHaveURL(/\/overview$/)
  const monthlyReport = page.locator('.monthly-review')
  await expect(monthlyReport.getByRole('heading', { name: 'Monthly Report' })).toBeVisible()
  await expect(monthlyReport).toContainText('There is not enough previous-month data for a comparison yet.')
  await expect(monthlyReport).toContainText('Dining')
})
