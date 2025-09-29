// Re-export main classes and types for convenience
export * from './contactNote';
export * from './contactManager'; // This will be the new modular structure
export * from './vcardManager';
export * from './vcardFile';

// Re-export utility functions
export { parseKey, mdRender, createContactSlug, createNameSlug } from './contactNote';