/**
 * @fileoverview Test utilities and helper functions
 * 
 * This module provides common utility functions used across tests
 * for setup, assertions, and data manipulation.
 * 
 * @module TestUtils
 */

import { vi } from 'vitest';

/**
 * Waits for a specified amount of time
 * Useful for testing async operations or timeouts
 * 
 * @example
 * await wait(100); // Wait 100ms
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for a condition to be true
 * Polls the condition function until it returns true or timeout is reached
 * 
 * @example
 * await waitForCondition(() => someValue === expectedValue, 1000, 50);
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 1000,
  interval: number = 50
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await wait(interval);
  }
}

/**
 * Creates a spy that tracks all calls to a function
 * Returns both the spy and a helper to get call arguments
 * 
 * @example
 * const { spy, getCallArgs } = createSpy();
 * someFunction(spy);
 * const firstCallArgs = getCallArgs(0);
 */
export function createSpy<T = any>() {
  const spy = vi.fn();
  
  return {
    spy,
    getCallArgs: (callIndex: number = 0): T => spy.mock.calls[callIndex],
    getCallCount: () => spy.mock.calls.length,
    reset: () => spy.mockReset()
  };
}

/**
 * Runs a test with retry logic
 * Useful for flaky async tests
 * 
 * @example
 * await withRetry(() => {
 *   expect(asyncValue).toBe(expected);
 * }, 3, 100);
 */
export async function withRetry<T>(
  testFn: () => T | Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await testFn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        await wait(delayMs);
      }
    }
  }
  
  throw lastError || new Error('Test failed after retries');
}

/**
 * Batch test runner for testing multiple cases
 * Helps reduce boilerplate when testing similar scenarios
 * 
 * @example
 * const testCases = [
 *   { input: 'test.vcf', expected: true },
 *   { input: 'test.txt', expected: false }
 * ];
 * await runTestCases(testCases, async (testCase) => {
 *   const result = isVcfFile(testCase.input);
 *   expect(result).toBe(testCase.expected);
 * });
 */
export async function runTestCases<T>(
  testCases: T[],
  testFn: (testCase: T, index: number) => void | Promise<void>
): Promise<void> {
  for (let i = 0; i < testCases.length; i++) {
    await testFn(testCases[i], i);
  }
}

/**
 * Deep clone helper for test data
 * 
 * @example
 * const original = { a: 1, b: { c: 2 } };
 * const copy = deepClone(original);
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Assertion helper for checking if an object contains expected properties
 * 
 * @example
 * expectToContain(result, { UID: 'test-123', FN: 'Test' });
 */
export function expectToContain(
  actual: Record<string, any>,
  expected: Record<string, any>
): void {
  Object.keys(expected).forEach(key => {
    if (!(key in actual)) {
      throw new Error(`Expected object to have property '${key}'`);
    }
    if (actual[key] !== expected[key]) {
      throw new Error(
        `Expected '${key}' to be '${expected[key]}' but got '${actual[key]}'`
      );
    }
  });
}

/**
 * Creates a mock vault with an in-memory file system
 * Useful for integration-style tests
 * 
 * @example
 * const vault = createMockVault();
 * vault.create('test.md', 'content');
 * const content = await vault.read('test.md');
 */
export function createMockVault() {
  const files = new Map<string, string>();
  
  return {
    files,
    
    create: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
      return { path, basename: path.split('/').pop() };
    }),
    
    read: vi.fn(async (file: any) => {
      const path = typeof file === 'string' ? file : file.path;
      const content = files.get(path);
      if (!content) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    }),
    
    modify: vi.fn(async (file: any, content: string) => {
      const path = typeof file === 'string' ? file : file.path;
      files.set(path, content);
    }),
    
    delete: vi.fn(async (file: any) => {
      const path = typeof file === 'string' ? file : file.path;
      files.delete(path);
    }),
    
    exists: (path: string) => files.has(path),
    
    getAbstractFileByPath: vi.fn((path: string) => {
      if (files.has(path)) {
        return { path, basename: path.split('/').pop() };
      }
      return null;
    }),
    
    getMarkdownFiles: vi.fn(() => {
      return Array.from(files.keys())
        .filter(path => path.endsWith('.md'))
        .map(path => ({ path, basename: path.split('/').pop() }));
    })
  };
}

/**
 * Test data generators for common scenarios
 */
export const testDataGenerators = {
  /**
   * Generates a random UID
   */
  uid: (prefix: string = 'test') => `${prefix}-${Math.random().toString(36).substr(2, 9)}`,
  
  /**
   * Generates a random email
   */
  email: (name: string = 'test') => `${name}@example.com`,
  
  /**
   * Generates a random phone number
   */
  phone: () => `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
  
  /**
   * Generates a timestamp in VCard format
   */
  timestamp: (date: Date = new Date()) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}Z`;
  },
  
  /**
   * Generates multiple contacts with sequential data
   */
  contacts: (count: number, prefix: string = 'contact') => {
    return Array.from({ length: count }, (_, i) => ({
      UID: testDataGenerators.uid(`${prefix}-${i}`),
      FN: `${prefix} ${i}`,
      EMAIL: testDataGenerators.email(`${prefix}${i}`)
    }));
  }
};

/**
 * Mock console for capturing console output in tests
 * 
 * @example
 * const console = mockConsole();
 * someFunction(); // calls console.log
 * expect(console.getLogs()).toContain('expected message');
 * console.restore();
 */
export function mockConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.log = vi.fn((...args: any[]) => {
    logs.push(args.join(' '));
  });
  
  console.error = vi.fn((...args: any[]) => {
    errors.push(args.join(' '));
  });
  
  console.warn = vi.fn((...args: any[]) => {
    warns.push(args.join(' '));
  });
  
  return {
    getLogs: () => logs,
    getErrors: () => errors,
    getWarns: () => warns,
    clear: () => {
      logs.length = 0;
      errors.length = 0;
      warns.length = 0;
    },
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  };
}

/**
 * Creates a test timeout that fails the test if not cleared
 * Useful for ensuring async operations complete
 * 
 * @example
 * const timeout = createTestTimeout(1000, 'Operation took too long');
 * await someAsyncOperation();
 * timeout.clear();
 */
export function createTestTimeout(ms: number, message: string = 'Test timeout') {
  const timeoutId = setTimeout(() => {
    throw new Error(message);
  }, ms);
  
  return {
    clear: () => clearTimeout(timeoutId)
  };
}
