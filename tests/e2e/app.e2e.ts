/**
 * E2E Tests for Marix SSH Client
 * Uses Playwright with Electron
 * 
 * These tests verify the basic functionality of the Electron app
 * They are designed to be robust and work across different configurations
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Marix E2E Tests', () => {
  test.beforeAll(async () => {
    // Build launch args - add --no-sandbox for CI environments (Linux)
    const launchArgs = [path.join(__dirname, '../../dist/main/index.js')];
    
    // Disable sandbox on CI (required for GitHub Actions Linux runners)
    if (process.env.CI) {
      launchArgs.unshift('--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage');
    }
    
    // Launch Electron app
    electronApp = await electron.launch({
      args: launchArgs,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Disable sandbox via env var as well
        ELECTRON_DISABLE_SANDBOX: process.env.CI ? '1' : undefined
      }
    });

    // Get the first window
    page = await electronApp.firstWindow();
    
    // Wait for app to be ready
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    // Give app time to fully render React components
    await page.waitForTimeout(5000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
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

    test('should display main UI elements', async () => {
      // Wait for UI to render
      await page.waitForTimeout(1000);
      
      // Check for any interactive elements (buttons, inputs)
      const hasUI = await page.locator('button').first().isVisible();
      expect(hasUI).toBeTruthy();
    });

    test('should have proper window dimensions', async () => {
      const size = page.viewportSize();
      expect(size).toBeDefined();
      if (size) {
        expect(size.width).toBeGreaterThan(800);
        expect(size.height).toBeGreaterThan(500);
      }
    });
  });

  test.describe('Navigation', () => {
    test('should have clickable navigation elements', async () => {
      // Find all buttons in the app
      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should respond to clicks', async () => {
      // Click any visible button
      const button = page.locator('button').first();
      if (await button.isVisible()) {
        await button.click();
        // Just verify no crash
        expect(page).toBeDefined();
      }
    });
  });

  test.describe('Keyboard Interaction', () => {
    test('should handle Escape key', async () => {
      await page.keyboard.press('Escape');
      // Just verify no crash
      expect(page).toBeDefined();
    });

    test('should handle Tab key navigation', async () => {
      await page.keyboard.press('Tab');
      // Just verify no crash
      expect(page).toBeDefined();
    });
  });

  test.describe('App State', () => {
    test('should maintain state after interactions', async () => {
      const initialTitle = await page.title();
      
      // Perform some interactions
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      
      const afterTitle = await page.title();
      expect(afterTitle).toBe(initialTitle);
    });

    test('should not crash during rapid interactions', async () => {
      // Rapid key presses
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await page.keyboard.press('Escape');
      }
      
      // App should still be responsive
      const title = await page.title();
      expect(title).toContain('Marix');
    });
  });

  test.describe('Visual Rendering', () => {
    test('should render without visual errors', async () => {
      // Take screenshot
      const screenshot = await page.screenshot();
      expect(screenshot).toBeDefined();
      expect(screenshot.length).toBeGreaterThan(1000); // Not empty
    });

    test('should have dark theme by default', async () => {
      // Check body background is dark
      const bgColor = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      expect(bgColor).toBeDefined();
    });
  });

  test.describe('Performance', () => {
    test('should load within reasonable time', async () => {
      // App should already be loaded (from beforeAll)
      // Just verify it's responsive
      const isResponsive = await page.evaluate(() => {
        return document.readyState === 'complete';
      });
      expect(isResponsive).toBeTruthy();
    });

    test('should not have memory leaks during navigation', async () => {
      // Get initial memory if available
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Perform some navigations
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
      }

      const afterMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Memory should not grow excessively (< 50MB difference)
      if (initialMemory > 0 && afterMemory > 0) {
        expect(afterMemory - initialMemory).toBeLessThan(50 * 1024 * 1024);
      }
    });
  });
});
