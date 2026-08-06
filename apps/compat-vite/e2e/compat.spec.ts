import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('the nine-package meta import renders and hydrates', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const response = await page.goto('/')
  expect(response?.ok()).toBe(true)

  await expect(page.getByRole('heading', { name: 'Framework compatibility' })).toBeVisible()

  await page.getByLabel('Price').fill('12.50')
  await expect(page.getByTestId('currency-value')).toContainText('12.5')

  await page.getByRole('radio').nth(2).check()
  await expect(page.getByTestId('rating-value')).toHaveText('3')

  await page.getByLabel('Verification code').fill('123456')
  await expect(page.getByTestId('otp-value')).toHaveText('123456')

  await page.getByLabel('Password', { exact: true }).fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')

  await page.getByLabel('Phone number').fill('4155552671')
  await expect(page.getByTestId('phone-value')).toContainText('+1')

  await page.getByRole('spinbutton', { name: 'Month' }).press('ArrowUp')
  await expect(page.getByTestId('date-value')).not.toHaveText('2026-08-05')

  await page.getByRole('spinbutton', { name: 'Minute' }).press('ArrowUp')
  await expect(page.getByTestId('time-value')).not.toHaveText('14:30')

  await page.getByLabel('Tags').fill('accessibility')
  await page.getByLabel('Tags').press('Enter')
  await expect(page.getByTestId('tags-value')).toContainText('accessibility')

  await page.locator('input[type="file"]').setInputFiles({
    name: 'proof.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('proof'),
  })
  await expect(page.getByTestId('files-value')).toHaveText('proof.txt')

  const violations = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(violations.violations).toEqual([])
  expect(consoleErrors).toEqual([])
})
