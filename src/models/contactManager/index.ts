/**
 * Index file for ContactManager module components
 * Exports the optimized data-locality structure and maintains backward compatibility
 */

// Export the optimized ContactManager class and interface
export { ContactManager } from './optimizedContactManager';
export type { IContactManager } from './optimizedContactManager';

// Export optimized component classes for advanced usage
export { ContactManagerData } from './contactManagerData';
export { ConsistencyOperations } from './consistencyOperations';

// Export utility functions
export { ContactManagerUtils } from './contactManagerUtils';

// Re-export commonly used utility functions for backward compatibility
import { ContactManagerUtils } from './contactManagerUtils';
export const createContactFile = ContactManagerUtils.createContactFile;
export const handleFileCreation = ContactManagerUtils.handleFileCreation;
export const openFile = ContactManagerUtils.openFile;
export const openCreatedFile = ContactManagerUtils.openCreatedFile;
export const ensureHasName = ContactManagerUtils.ensureHasName;
export const getFrontmatterFromFiles = ContactManagerUtils.getFrontmatterFromFiles;

// Re-export legacy component classes for backward compatibility (deprecated)
export { ContactCache } from './contactCache';
export { ContactFileOperations } from './contactFileOperations';
export { ContactEventHandlers } from './contactEventHandlers';
export { ContactDataConsistency } from './contactDataConsistency';