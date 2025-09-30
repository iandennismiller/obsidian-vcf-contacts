/**
 * @fileoverview CuratorManager module exports
 * 
 * This module provides the curator system for managing contact data processing
 * and validation workflows. It includes the core curator manager, processor definitions,
 * and related types.
 * 
 * @module CuratorManager
 */

// Core curator manager
export { CuratorManager, curatorService } from './curatorManager';

// Curator type definitions
export * from './CuratorProcessor';
export * from './CuratorQueItem';
export * from './CuratorSettingProperties';
export * from './RunType';
