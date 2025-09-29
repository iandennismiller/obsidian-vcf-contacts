/**
 * @fileoverview Interface definition for VCard write queue operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that manage write queue operations.
 * 
 * @module IVCardWriteQueue
 */

/**
 * Interface for VCard write queue operations.
 * Defines the contract for classes that manage write queue operations.
 * 
 * @interface IVCardWriteQueue
 */
export interface IVCardWriteQueue {
  /**
   * Adds a VCard to the write queue.
   * @param uid - Unique identifier for the VCard
   * @param vcardData - VCard data to write
   * @returns Promise that resolves when queued
   */
  queueVcardWrite(uid: string, vcardData: string): Promise<void>;

  /**
   * Gets the current write queue status.
   * @returns Queue status information
   */
  getStatus(): { size: number; processing: boolean };

  /**
   * Clears the write queue.
   */
  clear(): void;
}