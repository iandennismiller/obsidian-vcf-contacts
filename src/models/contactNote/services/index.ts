/**
 * Services module exports
 * 
 * This module exports service classes for contactNote operations.
 */

export { ContactResolver, type ResolvedContact } from './ContactResolver';
export { 
  UIDConflictResolver, 
  type UIDConflict, 
  type ConflictDetectionResult, 
  type UIDUpdateResult, 
  type BulkUIDUpdateResult 
} from './UIDConflictResolver';
export { MarkdownRenderer } from './MarkdownRenderer';
