// Main ContactManager interface and class
export { ContactManager } from './contactManager';
export type { IContactManager } from './contactManager';

// Individual components (for advanced usage and testing)
export { ContactCache } from './contactCache';
export { ContactFileOperations } from './contactFileOperations';
export { ContactEventHandlers } from './contactEventHandlers';
export { ContactDataConsistency } from './contactDataConsistency';

// Utility functions
export { ContactManagerUtils } from './contactManagerUtils';

// Re-export commonly used utility functions for backwards compatibility
import { ContactManagerUtils } from './contactManagerUtils';
export const createContactFile = ContactManagerUtils.createContactFile;
export const handleFileCreation = ContactManagerUtils.handleFileCreation;
export const openFile = ContactManagerUtils.openFile;
export const openCreatedFile = ContactManagerUtils.openCreatedFile;
export const ensureHasName = ContactManagerUtils.ensureHasName;
export const getFrontmatterFromFiles = ContactManagerUtils.getFrontmatterFromFiles;