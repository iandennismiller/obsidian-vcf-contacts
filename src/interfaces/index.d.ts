/**
 * @fileoverview Central export for all interfaces
 * 
 * This file re-exports all individual interface files for convenience.
 * This allows existing imports to continue working while new code can
 * import from specific interface files.
 * 
 * @module InterfacesIndex
 */

// Curator System Interfaces
export * from './RunType.d';
export * from './CuratorQueItem.d';
export * from './CuratorProcessor.d';
export * from './CuratorSettingProperties.d';

// Contact Management Interfaces
export * from './IContactManager.d';
export * from './IContactManagerData.d';
export * from './IContactNote.d';

// VCard System Interfaces  
export * from './IVCardManager.d';
export * from './IVCardFile.d';

// Legacy exports for backward compatibility
// These maintain the existing consolidated interface exports
// until all imports are updated to use individual files

// Re-export from original consolidated files
export * from './contactManager.d';
export * from './contactNote.d';
export * from './curatorManager.d';
export * from './vcardFile.d';
export * from './vcardManager.d';