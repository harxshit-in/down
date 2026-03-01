import { test, expect } from '@playwright/test'

// ------------------------------------------------------------------
// Landing Page
// ------------------------------------------------------------------
test.describe('Landing Page', () => {
  test('loads and shows hero section', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText(/Stream knowledge/i)
  })

  test('search form is present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
  })

  test('category tabs are rendered', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button', { hasText: 'Tech' })).toBeVisible()
  })

  test('navbar shows login and signup', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /Log in/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Sign up/i })).toBeVisible()
  })
})

// ------------------------------------------------------------------
// Auth Pages
// ------------------------------------------------------------------
test.describe('Auth', () => {
  test('login page renders form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible()
  })

  test('signup page renders form', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[placeholder*="Doe"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Create account/i })).toBeVisible()
  })

  test('login page has Google sign-in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/Continue with Google/i)).toBeVisible()
  })

  test('navigates to signup from login page', async ({ page }) => {
    await page.goto('/login')
    await page.click('text=Sign up')
    await expect(page).toHaveURL('/signup')
  })
})

// ------------------------------------------------------------------
// Admin redirect (unauthenticated)
// ------------------------------------------------------------------
test.describe('Admin routes', () => {
  test('redirects unauthenticated users away from admin', async ({ page }) => {
    await page.goto('/admin')
    // Should redirect to / or /login
    await expect(page).not.toHaveURL('/admin')
  })
})

// ------------------------------------------------------------------
// Navigation
// ------------------------------------------------------------------
test.describe('Navigation', () => {
  test('logo links to home', async ({ page }) => {
    await page.goto('/login')
    await page.click('text=LearnoStream')
    await expect(page).toHaveURL('/')
  })
})
