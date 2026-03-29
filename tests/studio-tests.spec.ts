import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/app/login');
  await page.getByRole('button', { name: 'Login with GitLab' }).click();
  await page.getByRole('textbox', { name: 'Search projects...' }).click();
  await page.getByRole('textbox', { name: 'Search projects...' }).fill('studio');
  await page.getByRole('textbox', { name: 'Search projects...' }).press('Enter');
  await page.getByRole('row', { name: 'Studio-Self-Test Workspace' }).getByRole('button').click();
  await page.locator('.lucide.lucide-chevron-right.h-3').first().click();
  await page.locator('.lucide.lucide-chevron-right.h-3').first().click();
  await page.locator('.flex-1 > div:nth-child(2) > .group > .lucide.lucide-chevron-right > path').click();
  await page.getByRole('link', { name: 'Scripts' }).click();
  await page.getByRole('link', { name: 'Executions' }).click();
  await page.getByRole('listitem').filter({ hasText: 'ExecutionsToggle' }).getByRole('button').click();
  await page.getByRole('link', { name: 'Data templates' }).click();
  await page.getByRole('button', { name: 'Go Back' }).click();
  await page.getByRole('button', { name: 'Studio-Self-Test Local' }).click();
  await page.getByText('Switch Project').click();
  await page.getByRole('row', { name: '1 Workspace Active Admin Open' }).getByRole('button').click();
  await page.locator('.lucide.lucide-chevron-right.h-3').first().click();
  await page.locator('.lucide.lucide-chevron-right.h-3').click();
  await page.getByTestId('right-pane').getByText('auth.spec.ts').click();
});