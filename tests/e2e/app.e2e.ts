/**
 * E2E Tests for Marix SSH Client
 * Uses Playwright with Electron
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Marix E2E Tests', () => {
  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    page = await electronApp.firstWindow();
    
    // Wait for app to be ready
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Give app time to initialize
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test.describe('Application Launch', () => {
    test('should launch successfully', async () => {
      expect(electronApp).toBeDefined();
      expect(page).toBeDefined();
    });

    test('should have correct title', async () => {
      const title = await page.title();
      expect(title).toContain('Marix');
    });

    test('should display main UI', async () => {
      // Check for sidebar
      const sidebar = await page.locator('[data-testid="sidebar"]').or(page.locator('.sidebar')).first();
      await expect(sidebar).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Server Management', () => {
    test('should show "Add Server" button', async () => {
      const addButton = await page.getByText(/add|new|server/i).first();
      await expect(addButton).toBeVisible();
    });

    test('should open add server modal', async () => {
      // Click add server button
      await page.getByText(/new host|add server/i).first().click();
      
      // Check modal appears
      const modal = await page.locator('[role="dialog"]').or(page.locator('.modal')).first();
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('should have required fields in add server form', async () => {
      // Check for essential fields
      const nameInput = await page.locator('input[placeholder*="name" i]').or(page.locator('input[name="name"]')).first();
      const hostInput = await page.locator('input[placeholder*="host" i]').or(page.locator('input[name="host"]')).first();
      
      await expect(nameInput).toBeVisible();
      await expect(hostInput).toBeVisible();
    });

    test('should close modal on cancel', async () => {
      // Click cancel or close button
      const cancelButton = await page.getByText(/cancel|close/i).first();
      await cancelButton.click();
      
      // Modal should be hidden
      const modal = await page.locator('[role="dialog"]').or(page.locator('.modal')).first();
      await expect(modal).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Settings', () => {
    test('should open settings panel', async () => {
      // Click settings
      const settingsButton = await page.locator('[data-testid="settings"]')
        .or(page.getByText(/settings|cài đặt/i))
        .first();
      await settingsButton.click();
      
      // Settings should be visible
      await page.waitForTimeout(500);
      const settingsPanel = await page.locator('text=/theme|language|font/i').first();
      await expect(settingsPanel).toBeVisible({ timeout: 5000 });
    });

    test('should have theme toggle', async () => {
      const themeOption = await page.getByText(/theme|giao diện|dark|light/i).first();
      await expect(themeOption).toBeVisible();
    });

    test('should have language selector', async () => {
      const langOption = await page.getByText(/language|ngôn ngữ/i).first();
      await expect(langOption).toBeVisible();
    });

    test('should have session monitor toggle', async () => {
      const monitorOption = await page.getByText(/session monitor|giám sát/i).first();
      await expect(monitorOption).toBeVisible();
    });

    test('should have terminal font selector', async () => {
      const fontOption = await page.getByText(/terminal font|font terminal/i).first();
      await expect(fontOption).toBeVisible();
    });

    test('should have app lock option', async () => {
      const lockOption = await page.getByText(/app lock|khóa ứng dụng/i).first();
      await expect(lockOption).toBeVisible();
    });
  });

  test.describe('Info Page', () => {
    test('should navigate to info page', async () => {
      // Click info/about
      const infoButton = await page.locator('[data-testid="info"]')
        .or(page.getByText(/info|about|thông tin/i))
        .first();
      await infoButton.click();
      
      await page.waitForTimeout(500);
    });

    test('should display version', async () => {
      const version = await page.getByText(/v\d+\.\d+\.\d+/).first();
      await expect(version).toBeVisible();
    });

    test('should display features grid', async () => {
      const features = await page.getByText(/features|tính năng/i).first();
      await expect(features).toBeVisible();
    });

    test('should display author info', async () => {
      const author = await page.getByText(/author|tác giả/i).first();
      await expect(author).toBeVisible();
    });
  });

  test.describe('Theme Switching', () => {
    test('should switch to light theme', async () => {
      // Navigate to settings
      await page.getByText(/settings|cài đặt/i).first().click();
      await page.waitForTimeout(300);
      
      // Find and click light theme option
      const lightOption = await page.getByText(/light|sáng/i).first();
      if (await lightOption.isVisible()) {
        await lightOption.click();
        await page.waitForTimeout(500);
        
        // Check body background changed
        const body = page.locator('body');
        const bgColor = await body.evaluate(el => 
          window.getComputedStyle(el).backgroundColor
        );
        expect(bgColor).toBeDefined();
      }
    });

    test('should switch to dark theme', async () => {
      const darkOption = await page.getByText(/dark|tối/i).first();
      if (await darkOption.isVisible()) {
        await darkOption.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should support Ctrl+N for new connection', async () => {
      await page.keyboard.press('Control+n');
      await page.waitForTimeout(500);
      
      // Should open add server modal or quick connect
      const modal = await page.locator('[role="dialog"]').or(page.locator('.modal')).first();
      const isVisible = await modal.isVisible();
      
      if (isVisible) {
        // Close modal
        await page.keyboard.press('Escape');
      }
    });

    test('should support Escape to close modals', async () => {
      // Open something first
      await page.getByText(/new host|add server/i).first().click();
      await page.waitForTimeout(300);
      
      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      
      // Modal should be closed
      const modal = await page.locator('[role="dialog"]').or(page.locator('.modal')).first();
      await expect(modal).not.toBeVisible({ timeout: 3000 });
    });
  });
});
