// Minimal mocks for Obsidian API - only what's needed for tests
export const App = {
  workspace: {
    openFile: vi.fn(),
    getLeaf: vi.fn()
  },
  vault: {
    recurseChildren: vi.fn(),
    read: vi.fn(),
    modify: vi.fn()
  }
};
export class Modal {
  constructor(app) {
    this.app = app;
  }
  open() {}
  close() {}
}  
export const Notice = vi.fn();
export const TFile = {};
export const TFolder = {};
export const Vault = { recurseChildren: () => {} };
export const Workspace = {};
export const normalizePath = (path: string) => path;
export const Platform = { isMobileApp: false, isAndroidApp: false };
export const stringifyYaml = vi.fn((obj) => 
  Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n')
);

import { vi } from 'vitest';
