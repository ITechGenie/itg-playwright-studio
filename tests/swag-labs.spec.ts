import { test, expect } from '@playwright/test';

test('SauceDemo E2E Flow with Dynamic Data', async ({ page }) => {
  // Use fallback values so the script still runs locally if variables aren't injected
  const siteUrl = process.env.siteurl || 'https://www.saucedemo.com/';
  const appUsername = process.env.app_username || 'standard_user';
  const appPassword = process.env.app_password || 'secret_sauce';
  const appUserFirstName = process.env.app_user_first_name || 'Testing fname';
  const appUserLastName = process.env.app_user_last_name || 'Testing lname';
  const appUserZip = process.env.app_user_zip || '123123';

  console.log("Site url: " + siteUrl + " - appUsername: " + appUsername);

  await page.goto(siteUrl);

  await page.locator('[data-test="username"]').click();
  await page.locator('[data-test="username"]').fill(appUsername);

  await page.locator('[data-test="password"]').click();
  await page.locator('[data-test="password"]').fill(appPassword);

  await page.locator('[data-test="login-button"]').click();

  await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  await page.locator('[data-test="add-to-cart-test.allthethings()-t-shirt-(red)"]').click();
  await page.getByRole('button', { name: 'Open Menu' }).click();
  await page.locator('[data-test="shopping-cart-link"]').click();
  await page.locator('[data-test="remove-test.allthethings()-t-shirt-(red)"]').click();
  await page.locator('[data-test="checkout"]').click();

  await page.locator('[data-test="firstName"]').click();
  await page.locator('[data-test="firstName"]').fill(appUserFirstName);
  await page.locator('[data-test="firstName"]').press('Tab');

  await page.locator('[data-test="lastName"]').fill(appUserLastName);
  await page.locator('[data-test="postalCode"]').click();
  await page.locator('[data-test="postalCode"]').fill(appUserZip);

  await page.locator('[data-test="continue"]').click();
  await page.locator('[data-test="finish"]').click();
  await page.locator('[data-test="back-to-products"]').click();
});
