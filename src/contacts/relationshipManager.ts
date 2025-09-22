/**
 * @fileoverview Service for managing relationships between contacts.
 * 
 * This service handles:
 * - Synchronizing RELATED fields between contacts
 * - Rendering relationships in markdown format
 * - Parsing relationship changes from markdown
 * - Maintaining bidirectional relationship consistency
 */

import { App, TFile } from 'obsidian';
import { getFrontmatterFromFiles, updateFrontMatterValue } from './contactFrontmatter';
import { 
  parseRelatedField, 
  formatRelatedField, 
  formatNameBasedRelatedField,
  getComplementRelationship,
  renderRelationshipMarkdown,
  parseRelationshipMarkdown,
  ParsedRelation
} from './relationships';
import { parseKey } from './contactDataKeys';
import { loggingService } from '../services/loggingService';

export interface ContactRelationship {
  contactFile?: TFile; // Optional since contact might not exist yet
  contactName: string;
  uid?: string; // Optional for name-based relationships
  relationshipType: string;
  isNameBased: boolean;
}

export class RelationshipManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Gets all relationships for a contact from its frontmatter.
   */
  async getContactRelationships(contactFile: TFile): Promise<ContactRelationship[]> {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
    if (!frontmatter) return [];

    const relationships: ContactRelationship[] = [];
    const allContactFiles = await this.getAllContactFiles();

    for (const [key, value] of Object.entries(frontmatter)) {
      if (typeof value !== 'string') continue;
      
      const keyObj = parseKey(key);
      if (keyObj.key === 'RELATED') {
        const parsedRelation = parseRelatedField(value, keyObj.type);
        if (parsedRelation) {
          if (parsedRelation.isNameBased) {
            // Name-based relationship - contact might not exist
            const relatedContact = await this.findContactByName(parsedRelation.name!, allContactFiles);
            relationships.push({
              contactFile: relatedContact || undefined,
              contactName: parsedRelation.name!,
              relationshipType: parsedRelation.type,
              isNameBased: true
            });
          } else {
            // UID-based relationship
            const relatedContact = await this.findContactByUID(parsedRelation.uid!, allContactFiles);
            if (relatedContact) {
              relationships.push({
                contactFile: relatedContact,
                contactName: this.getContactDisplayName(relatedContact),
                uid: parsedRelation.uid!,
                relationshipType: parsedRelation.type,
                isNameBased: false
              });
            }
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Adds a relationship between two contacts and ensures bidirectional consistency.
   */
  async addRelationship(
    sourceFile: TFile, 
    targetUID: string, 
    relationshipType: string
  ): Promise<void> {
    const allContactFiles = await this.getAllContactFiles();
    const targetFile = await this.findContactByUID(targetUID, allContactFiles);
    
    if (!targetFile) {
      throw new Error(`Target contact with UID ${targetUID} not found`);
    }

    // Add relationship to source contact
    await this.addRelationshipToContact(sourceFile, targetUID, relationshipType);
    
    // Add complement relationship to target contact
    const complementType = getComplementRelationship(relationshipType);
    const sourceUID = await this.getContactUID(sourceFile);
    if (sourceUID) {
      await this.addRelationshipToContact(targetFile, sourceUID, complementType);
      
      // Update the target contact's relationships section to reflect the new relationship
      // This is a "system update" so we re-render from frontmatter
      await this.updateAffectedContactRelationships(targetFile);
    }
  }

  /**
   * Adds a name-based relationship when the target contact doesn't exist yet.
   */
  async addNameBasedRelationship(
    sourceFile: TFile,
    targetName: string,
    relationshipType: string
  ): Promise<void> {
    // Add name-based relationship to source contact
    await this.addNameBasedRelationshipToContact(sourceFile, targetName, relationshipType);
  }

  /**
   * Attempts to upgrade name-based relationships to UID-based when contacts are found.
   */
  async upgradeNameBasedRelationships(contactFile: TFile): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
    if (!frontmatter) return;

    const allContactFiles = await this.getAllContactFiles();
    const upgrades: Array<{key: string, oldValue: string, newValue: string}> = [];

    for (const [key, value] of Object.entries(frontmatter)) {
      if (typeof value !== 'string') continue;
      
      const keyObj = parseKey(key);
      if (keyObj.key === 'RELATED') {
        const parsedRelation = parseRelatedField(value, keyObj.type);
        if (parsedRelation && parsedRelation.isNameBased) {
          // Check if the contact now exists
          const targetFile = await this.findContactByName(parsedRelation.name!, allContactFiles);
          if (targetFile) {
            const targetUID = await this.getContactUID(targetFile);
            if (targetUID) {
              const newValue = formatRelatedField(targetUID);
              upgrades.push({key, oldValue: value, newValue});
            }
          }
        }
      }
    }

    // Apply upgrades
    for (const upgrade of upgrades) {
      await updateFrontMatterValue(contactFile, upgrade.key, upgrade.newValue, this.app);
    }

    if (upgrades.length > 0) {
      loggingService.info(`Upgraded ${upgrades.length} name-based relationships to UID-based for ${contactFile.basename}`);
    }
  }

  /**
   * Removes a relationship between two contacts and maintains bidirectional consistency.
   */
  async removeRelationship(
    sourceFile: TFile, 
    targetUID: string, 
    relationshipType: string
  ): Promise<void> {
    const allContactFiles = await this.getAllContactFiles();
    const targetFile = await this.findContactByUID(targetUID, allContactFiles);
    
    // Remove relationship from source contact
    await this.removeRelationshipFromContact(sourceFile, targetUID, relationshipType);
    
    // Remove complement relationship from target contact
    if (targetFile) {
      const complementType = getComplementRelationship(relationshipType);
      const sourceUID = await this.getContactUID(sourceFile);
      if (sourceUID) {
        await this.removeRelationshipFromContact(targetFile, sourceUID, complementType);
        
        // Update the target contact's relationships section to reflect the removal
        // This is a "system update" so we re-render from frontmatter
        await this.updateAffectedContactRelationships(targetFile);
      }
    }
  }

  /**
   * Removes a name-based relationship from a contact.
   */
  async removeNameBasedRelationship(
    sourceFile: TFile,
    targetName: string,
    relationshipType: string
  ): Promise<void> {
    await this.removeNameBasedRelationshipFromContact(sourceFile, targetName, relationshipType);
  }

  /**
   * Renders relationships as markdown for display in the contact note.
   */
  async renderRelationshipsMarkdown(contactFile: TFile): Promise<string> {
    const relationships = await this.getContactRelationships(contactFile);
    const currentContactName = this.getContactDisplayName(contactFile);
    
    if (relationships.length === 0) {
      // Return header with empty content instead of empty string to preserve the section
      return `## Relationships\n\n`;
    }

    const lines = relationships.map(rel => 
      renderRelationshipMarkdown(rel.contactName, rel.relationshipType, currentContactName)
    );

    return `## Relationships\n\n${lines.join('\n')}\n`;
  }

  /**
   * Syncs relationship changes from markdown back to frontmatter.
   */
  async syncRelationshipsFromMarkdown(contactFile: TFile, relationshipsSection: string): Promise<void> {
    const lines = relationshipsSection.split('\n').filter(line => line.trim().startsWith('-'));
    const currentRelationships = await this.getContactRelationships(contactFile);
    const newRelationships: Array<{ contactName: string; relationshipType: string }> = [];

    // Parse relationships from markdown
    for (const line of lines) {
      const parsed = parseRelationshipMarkdown(line);
      if (parsed) {
        newRelationships.push(parsed);
      }
    }

    // Find relationships to remove
    const toRemove = currentRelationships.filter(current => 
      !newRelationships.some(newRel => 
        newRel.contactName === current.contactName && 
        newRel.relationshipType === current.relationshipType
      )
    );

    // Find relationships to add
    const toAdd = newRelationships.filter(newRel => 
      !currentRelationships.some(current => 
        current.contactName === newRel.contactName && 
        current.relationshipType === newRel.relationshipType
      )
    );

    // Remove old relationships
    for (const rel of toRemove) {
      if (rel.isNameBased) {
        await this.removeNameBasedRelationship(contactFile, rel.contactName, rel.relationshipType);
      } else if (rel.uid) {
        await this.removeRelationship(contactFile, rel.uid, rel.relationshipType);
      }
    }

    // Add new relationships
    for (const rel of toAdd) {
      const targetFile = await this.findContactByName(rel.contactName);
      if (targetFile) {
        // Contact exists - use UID-based relationship
        const targetUID = await this.getContactUID(targetFile);
        if (targetUID) {
          await this.addRelationship(contactFile, targetUID, rel.relationshipType);
        }
      } else {
        // Contact doesn't exist - use name-based relationship
        await this.addNameBasedRelationship(contactFile, rel.contactName, rel.relationshipType);
      }
    }

    // After syncing, try to upgrade any name-based relationships
    await this.upgradeNameBasedRelationships(contactFile);
  }

  /**
   * Private helper methods
   */

  private async addRelationshipToContact(
    contactFile: TFile, 
    targetUID: string, 
    relationshipType: string
  ): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter || {};
    let relationshipKey = `RELATED[${relationshipType.toLowerCase()}]`;
    
    // Check if this key already exists, if so, add an index
    let index = 1;
    while (frontmatter[relationshipKey]) {
      relationshipKey = `RELATED[${index}:${relationshipType.toLowerCase()}]`;
      index++;
    }

    const formattedUID = formatRelatedField(targetUID);
    await updateFrontMatterValue(contactFile, relationshipKey, formattedUID, this.app);
  }

  private async addNameBasedRelationshipToContact(
    contactFile: TFile, 
    targetName: string, 
    relationshipType: string
  ): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter || {};
    let relationshipKey = `RELATED[${relationshipType.toLowerCase()}]`;
    
    // Check if this key already exists, if so, add an index
    let index = 1;
    while (frontmatter[relationshipKey]) {
      relationshipKey = `RELATED[${index}:${relationshipType.toLowerCase()}]`;
      index++;
    }

    const formattedName = formatNameBasedRelatedField(targetName);
    await updateFrontMatterValue(contactFile, relationshipKey, formattedName, this.app);
  }

  private async removeRelationshipFromContact(
    contactFile: TFile, 
    targetUID: string, 
    relationshipType: string
  ): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
    if (!frontmatter) return;

    const formattedUID = formatRelatedField(targetUID);
    
    // Find and remove the matching RELATED field
    for (const [key, value] of Object.entries(frontmatter)) {
      if (typeof value !== 'string') continue;
      
      const keyObj = parseKey(key);
      if (keyObj.key === 'RELATED' && 
          keyObj.type?.toLowerCase() === relationshipType.toLowerCase() &&
          value === formattedUID) {
        await updateFrontMatterValue(contactFile, key, '', this.app);
        break;
      }
    }
  }

  private async removeNameBasedRelationshipFromContact(
    contactFile: TFile, 
    targetName: string, 
    relationshipType: string
  ): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
    if (!frontmatter) return;

    const formattedName = formatNameBasedRelatedField(targetName);
    
    // Find and remove the matching RELATED field
    for (const [key, value] of Object.entries(frontmatter)) {
      if (typeof value !== 'string') continue;
      
      const keyObj = parseKey(key);
      if (keyObj.key === 'RELATED' && 
          keyObj.type?.toLowerCase() === relationshipType.toLowerCase() &&
          value === formattedName) {
        await updateFrontMatterValue(contactFile, key, '', this.app);
        break;
      }
    }
  }

  private async getAllContactFiles(): Promise<TFile[]> {
    const contactsFolder = this.app.vault.getAllLoadedFiles()
      .filter(file => file instanceof TFile && file.extension === 'md') as TFile[];
    
    const contactFiles = await getFrontmatterFromFiles(contactsFolder);
    return contactFiles.map((contact: any) => contact.file);
  }

  private async findContactByUID(uid: string, contactFiles: TFile[]): Promise<TFile | null> {
    for (const file of contactFiles) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontmatter?.UID === uid || frontmatter?.UID === `urn:uuid:${uid}`) {
        return file;
      }
    }
    return null;
  }

  private async findContactByName(name: string, contactFiles?: TFile[]): Promise<TFile | null> {
    const files = contactFiles || await this.getAllContactFiles();
    for (const file of files) {
      const displayName = this.getContactDisplayName(file);
      if (displayName === name) {
        return file;
      }
    }
    return null;
  }

  private getContactDisplayName(contactFile: TFile): string {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
    return frontmatter?.FN || frontmatter?.['N.GN'] + ' ' + frontmatter?.['N.FN'] || contactFile.basename;
  }

  private async getContactUID(contactFile: TFile): Promise<string | null> {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
    let uid = frontmatter?.UID;
    
    if (!uid) {
      // Generate a new UID if one doesn't exist
      uid = `urn:uuid:${crypto.randomUUID()}`;
      await updateFrontMatterValue(contactFile, 'UID', uid, this.app);
    }
    
    // Strip urn:uuid: prefix if present for consistent handling
    return uid.startsWith('urn:uuid:') ? uid.substring(9) : uid;
  }

  /**
   * Updates the relationships section for a contact that was affected by bidirectional sync.
   * This re-renders the relationships section from frontmatter data.
   */
  private async updateAffectedContactRelationships(contactFile: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(contactFile);
      const relationshipsMarkdown = await this.renderRelationshipsMarkdown(contactFile);
      
      const updatedContent = this.replaceRelationshipsSection(content, relationshipsMarkdown);
      
      if (updatedContent !== content) {
        await this.app.vault.modify(contactFile, updatedContent);
      }
    } catch (error) {
      loggingService.warn(`Error updating affected contact relationships: ${error.message}`);
    }
  }

  /**
   * Replaces the relationships section in the content with new markdown.
   * This is similar to the method in RelationshipSyncService but kept here to avoid circular deps.
   */
  private replaceRelationshipsSection(content: string, newRelationshipsMarkdown: string): string {
    // Find the relationships section using case-insensitive regex
    const relationshipsSectionRegex = /^## [Rr]elationships?\s*\n([\s\S]*?)(?=\n## |\n### |\n#### |$)/m;
    
    if (relationshipsSectionRegex.test(content)) {
      // Replace existing relationships section, ensuring we preserve the standardized header
      return content.replace(relationshipsSectionRegex, newRelationshipsMarkdown.trim());
    } else {
      // Find where to insert the relationships section
      // Look for the Notes section or other common sections
      const notesSectionRegex = /^#### Notes\s*\n([\s\S]*?)(?=\n## |\n### |\n#### |$)/m;
      const match = content.match(notesSectionRegex);
      
      if (match) {
        // Insert after the Notes section
        const notesEnd = match.index! + match[0].length;
        return content.slice(0, notesEnd) + '\n\n' + newRelationshipsMarkdown + content.slice(notesEnd);
      } else {
        // Insert before the final hashtags if no Notes section
        const hashtagMatch = content.match(/\n(#\w+[\s#\w]*)\s*$/);
        if (hashtagMatch) {
          const hashtagStart = hashtagMatch.index!;
          return content.slice(0, hashtagStart) + '\n\n' + newRelationshipsMarkdown + content.slice(hashtagStart);
        } else {
          // Append at the end
          return content + '\n\n' + newRelationshipsMarkdown;
        }
      }
    }
  }
}