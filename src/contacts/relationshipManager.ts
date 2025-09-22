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
  getComplementRelationship,
  renderRelationshipMarkdown,
  parseRelationshipMarkdown,
  ParsedRelation
} from './relationships';
import { parseKey } from './contactDataKeys';

export interface ContactRelationship {
  contactFile: TFile;
  contactName: string;
  uid: string;
  relationshipType: string;
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
          // Find the contact file for this UID
          const relatedContact = await this.findContactByUID(parsedRelation.uid, allContactFiles);
          if (relatedContact) {
            relationships.push({
              contactFile: relatedContact,
              contactName: this.getContactDisplayName(relatedContact),
              uid: parsedRelation.uid,
              relationshipType: parsedRelation.type
            });
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
      }
    }
  }

  /**
   * Renders relationships as markdown for display in the contact note.
   */
  async renderRelationshipsMarkdown(contactFile: TFile): Promise<string> {
    const relationships = await this.getContactRelationships(contactFile);
    const currentContactName = this.getContactDisplayName(contactFile);
    
    if (relationships.length === 0) {
      return '';
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
      await this.removeRelationship(contactFile, rel.uid, rel.relationshipType);
    }

    // Add new relationships
    for (const rel of toAdd) {
      const targetFile = await this.findContactByName(rel.contactName);
      if (targetFile) {
        const targetUID = await this.getContactUID(targetFile);
        if (targetUID) {
          await this.addRelationship(contactFile, targetUID, rel.relationshipType);
        }
      }
    }
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

  private async findContactByName(name: string): Promise<TFile | null> {
    const contactFiles = await this.getAllContactFiles();
    for (const file of contactFiles) {
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
}