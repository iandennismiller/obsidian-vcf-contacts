/**
 * @fileoverview Legacy re-exports from interfaces directory
 * 
 * This file is deprecated. Import from src/definitions instead.
 * 
 * @deprecated Use src/definitions for type definitions
 * @module InterfacesIndex
 */

// Re-export from definitions for backward compatibility
export * from '../definitions/ContactsPluginSettings';
export * from '../definitions/RunType';
export * from '../definitions/CuratorQueItem';
export * from '../definitions/CuratorProcessor';
export * from '../definitions/CuratorSettingProperties';

// Legacy type re-exports for backward compatibility
export type { Gender, Contact, ParsedKey, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from '../models/contactNote/types';