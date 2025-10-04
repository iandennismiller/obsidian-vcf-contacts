import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VdirsyncerService } from '../../../src/plugin/services/vdirsyncerService';
import * as os from 'os';

// Mock fs/promises module
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe('VdirsyncerService', () => {
  let fsPromises: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    fsPromises = await import('fs/promises');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('expandHomePath', () => {
    it('should expand $HOME to user home directory', () => {
      const homeDir = os.homedir();
      const result = VdirsyncerService.expandHomePath('$HOME/.config/vdirsyncer/config');
      expect(result).toBe(`${homeDir}/.config/vdirsyncer/config`);
    });

    it('should be case-insensitive for $HOME', () => {
      const homeDir = os.homedir();
      const result = VdirsyncerService.expandHomePath('$home/.config/vdirsyncer/config');
      expect(result).toBe(`${homeDir}/.config/vdirsyncer/config`);
    });

    it('should handle empty string', () => {
      const result = VdirsyncerService.expandHomePath('');
      expect(result).toBe('');
    });

    it('should not modify paths without $HOME', () => {
      const path = '/absolute/path/to/config';
      const result = VdirsyncerService.expandHomePath(path);
      expect(result).toBe(path);
    });

    it('should only replace $HOME at the beginning of path', () => {
      const homeDir = os.homedir();
      const result = VdirsyncerService.expandHomePath('$HOME/some/$HOME/path');
      expect(result).toBe(`${homeDir}/some/$HOME/path`);
    });
  });

  describe('checkConfigExists', () => {
    it('should return true when config file exists', async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      const result = await VdirsyncerService.checkConfigExists('/path/to/config');

      expect(result).toBe(true);
      expect(fsPromises.access).toHaveBeenCalledWith('/path/to/config');
    });

    it('should return false when config file does not exist', async () => {
      vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT'));

      const result = await VdirsyncerService.checkConfigExists('/path/to/config');

      expect(result).toBe(false);
    });

    it('should return false for empty path', async () => {
      const result = await VdirsyncerService.checkConfigExists('');

      expect(result).toBe(false);
      expect(fsPromises.access).not.toHaveBeenCalled();
    });

    it('should expand $HOME before checking', async () => {
      const homeDir = os.homedir();
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      await VdirsyncerService.checkConfigExists('$HOME/.config/vdirsyncer/config');

      expect(fsPromises.access).toHaveBeenCalledWith(`${homeDir}/.config/vdirsyncer/config`);
    });

    it('should handle permission errors gracefully', async () => {
      vi.mocked(fsPromises.access).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await VdirsyncerService.checkConfigExists('/path/to/config');

      expect(result).toBe(false);
    });
  });

  describe('readConfig', () => {
    it('should read and return config file content', async () => {
      const configContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"';
      vi.mocked(fsPromises.readFile).mockResolvedValue(configContent);

      const result = await VdirsyncerService.readConfig('/path/to/config');

      expect(result).toBe(configContent);
      expect(fsPromises.readFile).toHaveBeenCalledWith('/path/to/config', 'utf-8');
    });

    it('should return null when file cannot be read', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await VdirsyncerService.readConfig('/path/to/config');

      expect(result).toBeNull();
    });

    it('should expand $HOME before reading', async () => {
      const homeDir = os.homedir();
      const configContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"';
      vi.mocked(fsPromises.readFile).mockResolvedValue(configContent);

      await VdirsyncerService.readConfig('$HOME/.config/vdirsyncer/config');

      expect(fsPromises.readFile).toHaveBeenCalledWith(
        `${homeDir}/.config/vdirsyncer/config`,
        'utf-8'
      );
    });

    it('should handle empty file content', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue('');

      const result = await VdirsyncerService.readConfig('/path/to/config');

      expect(result).toBe('');
    });

    it('should handle permission errors gracefully', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await VdirsyncerService.readConfig('/path/to/config');

      expect(result).toBeNull();
    });
  });

  describe('writeConfig', () => {
    it('should write content to config file', async () => {
      const configContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"';
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const result = await VdirsyncerService.writeConfig('/path/to/config', configContent);

      expect(result).toBe(true);
      expect(fsPromises.writeFile).toHaveBeenCalledWith('/path/to/config', configContent, 'utf-8');
    });

    it('should return false when write fails', async () => {
      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('EACCES'));

      const result = await VdirsyncerService.writeConfig('/path/to/config', 'content');

      expect(result).toBe(false);
    });

    it('should expand $HOME before writing', async () => {
      const homeDir = os.homedir();
      const configContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"';
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      await VdirsyncerService.writeConfig('$HOME/.config/vdirsyncer/config', configContent);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        `${homeDir}/.config/vdirsyncer/config`,
        configContent,
        'utf-8'
      );
    });

    it('should handle empty content', async () => {
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const result = await VdirsyncerService.writeConfig('/path/to/config', '');

      expect(result).toBe(true);
      expect(fsPromises.writeFile).toHaveBeenCalledWith('/path/to/config', '', 'utf-8');
    });

    it('should handle permission errors gracefully', async () => {
      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await VdirsyncerService.writeConfig('/path/to/config', 'content');

      expect(result).toBe(false);
    });

    it('should handle disk full errors gracefully', async () => {
      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('ENOSPC: no space left'));

      const result = await VdirsyncerService.writeConfig('/path/to/config', 'content');

      expect(result).toBe(false);
    });
  });
});
