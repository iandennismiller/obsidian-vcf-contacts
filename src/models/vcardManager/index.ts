// Core VCard manager class
export { VcardManager } from './vcardManager';

// Collection operations for managing multiple VCard files
export { VCardCollection } from './vcardCollection';
export type { VCardFileInfo } from './vcardCollection';

// Write queue for controlled VCard updates
export { VCardWriteQueue } from './writeQueue';

// File operations specific to manager responsibilities
export { VCardManagerFileOperations } from './fileOperations';