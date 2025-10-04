import * as fs from 'fs/promises';
import * as os from 'os';

/**
 * Service for managing vdirsyncer configuration file operations.
 * Provides utilities for reading, writing, and checking the existence of vdirsyncer config files.
 * 
 * Note: This service does not validate vdirsyncer config syntax or run vdirsyncer commands.
 * It simply provides file system access to the config file for viewing and editing.
 */
export class VdirsyncerService {
  /**
   * Expands $HOME in a file path to the actual user home directory.
   * 
   * @param filePath - Path that may contain $HOME variable
   * @returns Path with $HOME expanded to actual home directory
   * 
   * @example
   * ```typescript
   * expandHomePath("$HOME/.config/vdirsyncer/config")
   * // Returns: "/home/username/.config/vdirsyncer/config" (on Linux)
   * // Returns: "C:\\Users\\username\\.config\\vdirsyncer\\config" (on Windows)
   * ```
   */
  static expandHomePath(filePath: string): string {
    if (!filePath) {
      return filePath;
    }

    const homeDir = os.homedir();
    return filePath.replace(/^\$HOME/i, homeDir);
  }

  /**
   * Checks if the vdirsyncer config file exists at the specified path.
   * Automatically expands $HOME in the path before checking.
   * 
   * @param filePath - Path to config file (may contain $HOME)
   * @returns Promise resolving to true if file exists, false otherwise
   * 
   * @example
   * ```typescript
   * const exists = await checkConfigExists("$HOME/.config/vdirsyncer/config");
   * if (exists) {
   *   console.log("Config file found");
   * }
   * ```
   */
  static async checkConfigExists(filePath: string): Promise<boolean> {
    if (!filePath) {
      return false;
    }

    try {
      const expandedPath = this.expandHomePath(filePath);
      await fs.access(expandedPath);
      return true;
    } catch (error: any) {
      console.debug(`[VdirsyncerService] Config file not found: ${filePath}`);
      return false;
    }
  }

  /**
   * Reads the contents of the vdirsyncer config file.
   * Automatically expands $HOME in the path before reading.
   * 
   * @param filePath - Path to config file (may contain $HOME)
   * @returns Promise resolving to file contents as string, or null on error
   * 
   * @example
   * ```typescript
   * const config = await readConfig("$HOME/.config/vdirsyncer/config");
   * if (config) {
   *   console.log("Config loaded:", config);
   * }
   * ```
   */
  static async readConfig(filePath: string): Promise<string | null> {
    try {
      const expandedPath = this.expandHomePath(filePath);
      const content = await fs.readFile(expandedPath, 'utf-8');
      console.debug(`[VdirsyncerService] Config loaded from: ${expandedPath}`);
      return content;
    } catch (error: any) {
      console.debug(`[VdirsyncerService] Error reading config file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Writes content to the vdirsyncer config file.
   * Automatically expands $HOME in the path before writing.
   * 
   * @param filePath - Path to config file (may contain $HOME)
   * @param content - Content to write to file
   * @returns Promise resolving to true on success, false on error
   * 
   * @example
   * ```typescript
   * const success = await writeConfig(
   *   "$HOME/.config/vdirsyncer/config",
   *   "[general]\\nstatus_path = \"~/.vdirsyncer/status/\""
   * );
   * if (success) {
   *   console.log("Config saved successfully");
   * }
   * ```
   */
  static async writeConfig(filePath: string, content: string): Promise<boolean> {
    try {
      const expandedPath = this.expandHomePath(filePath);
      await fs.writeFile(expandedPath, content, 'utf-8');
      console.debug(`[VdirsyncerService] Config saved to: ${expandedPath}`);
      return true;
    } catch (error: any) {
      console.debug(`[VdirsyncerService] Error writing config file ${filePath}: ${error.message}`);
      return false;
    }
  }
}
