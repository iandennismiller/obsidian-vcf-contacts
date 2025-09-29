// Core VCard file class and operations
export { VcardFile } from './vcardFile';

// Types and enums
export * from './types';

// Parsing operations
export { VCardParser } from './parsing';

// Generation operations  
export { VCardGenerator } from './generation';

// File operations (static utilities)
export { VCardFileOperations } from './fileOperations';

// Backward compatibility - re-export static methods from VCardFileOperations as top-level
export {
  VCardFileOperations as VcardFileOps  // Alternative export name
} from './fileOperations';