import { App, TFile, EventRef, WorkspaceLeaf } from 'obsidian';

/**
 * Handles event management for contact manager operations.
 * Manages workspace events and automatic syncing triggers.
 */
export class ContactEventHandlers {
  private app: App;
  private eventRef: EventRef | null = null;
  private currentActiveFile: TFile | null = null;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Set up event listeners for automatic syncing when navigating away from contact files
   */
  setupEventListeners(): void {
    if (this.eventRef) {
      // Already set up
      return;
    }

    this.eventRef = this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
      this.handleActiveLeafChange(leaf);
    });

    console.log('[ContactEventHandlers] Event listeners set up');
  }

  /**
   * Clean up event listeners
   */
  cleanupEventListeners(): void {
    if (this.eventRef) {
      this.app.workspace.offref(this.eventRef);
      this.eventRef = null;
      console.log('[ContactEventHandlers] Event listeners cleaned up');
    }
  }

  /**
   * Handle active leaf change - track current active file
   */
  private handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    // Check if the view has a file property (duck typing for MarkdownView)
    const newActiveFile = (leaf?.view && 'file' in leaf.view) ? (leaf.view as any).file : null;
    
    this.currentActiveFile = newActiveFile;
  }

  /**
   * Get the currently active file
   */
  getCurrentActiveFile(): TFile | null {
    return this.currentActiveFile;
  }
}