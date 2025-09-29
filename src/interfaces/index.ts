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
export * from './RunType';
export * from './CuratorQueItem';
export * from './CuratorProcessor';
export * from './CuratorSettingProperties';

// Contact Management Interfaces
export * from './IContactManager';
export * from './IContactManagerData';
export * from './IContactNote';
export * from './IContactData';
export * from './IRelationshipOperations';
export * from './IMarkdownOperations';
export * from './ISyncOperations';
export * from './IConsistencyOperations';
export * from './IContactManagerUtils';

// VCard System Interfaces  
export * from './IVCardManager';
export * from './IVCardFile';
export * from './IVCardParser';
export * from './IVCardGenerator';
export * from './IVCardFileOperations';
export * from './IVCardCollection';
export * from './IVCardWriteQueue';
export * from './IVCardManagerFileOperations';

// Legacy type re-exports for backward compatibility
export type { Gender, Contact, ParsedKey, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from '../models/contactNote/types';