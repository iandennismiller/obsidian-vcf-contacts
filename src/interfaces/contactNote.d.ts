/**
 * @fileoverview Consolidated interface definitions for ContactNote module classes
 * 
 * This module re-exports all ContactNote-related interfaces from their individual files
 * for backward compatibility with existing imports.
 * 
 * @module ContactNoteInterfaces
 */

// Re-export all interfaces from individual files
export { IContactNote } from './IContactNote.d';
export { IContactData } from './IContactData.d';
export { IRelationshipOperations } from './IRelationshipOperations.d';
export { IMarkdownOperations } from './IMarkdownOperations.d';
export { ISyncOperations } from './ISyncOperations.d';

// Re-export types for convenience
export type { Gender, Contact, ParsedKey, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from '../models/contactNote/types';