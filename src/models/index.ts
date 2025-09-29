// Re-export main classes and types for convenience
export * from './contactNote';
export * from './contactManager'; // This will be the new modular structure

// New modular structure
export * from './vcardManager';
export * from './vcardFile';

// Backward compatibility - re-export from the new modular structure
export { VcardManager, VCFManager } from './vcardManager';
export type { VCardFileInfo, VCFFileInfo } from './vcardManager';
export { VcardFile } from './vcardFile';
export type { VCardForObsidianRecord, VCardToStringError, VCardToStringReply, VCardSupportedKey, VCardKind } from './vcardFile';
export { StructuredFields, VCardKinds } from './vcardFile';

// Re-export utility functions
export { parseKey, mdRender, createContactSlug, createNameSlug } from './contactNote';