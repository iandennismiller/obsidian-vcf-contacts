/**
 * Utilities for parsing and rendering the Related section in contact markdown notes
 */

export interface RelatedListItem {
  kind: string;
  target: string;
}

/**
 * Parse the Related section from markdown content
 */
export function parseRelatedSection(content: string): {
  relatedItems: RelatedListItem[];
  hasRelatedHeading: boolean;
  relatedHeadingMatch?: RegExpMatchArray;
} {
  const relatedItems: RelatedListItem[] = [];
  let hasRelatedHeading = false;
  let relatedHeadingMatch: RegExpMatchArray | undefined;

  // Find the Related heading (case insensitive, any depth)
  const headingRegex = /^(#{1,6})\s+related\s*$/gim;
  const matches = Array.from(content.matchAll(headingRegex));
  
  if (matches.length === 0) {
    return { relatedItems, hasRelatedHeading };
  }

  // Use the first Related heading found
  hasRelatedHeading = true;
  relatedHeadingMatch = matches[0];
  
  // Find the position after the heading
  const headingEnd = relatedHeadingMatch.index! + relatedHeadingMatch[0].length;
  
  // Find the next heading to determine the end of the Related section
  const nextHeadingRegex = /^#{1,6}\s+/gm;
  nextHeadingRegex.lastIndex = headingEnd;
  const nextHeadingMatch = nextHeadingRegex.exec(content);
  
  const sectionEnd = nextHeadingMatch ? nextHeadingMatch.index : content.length;
  const relatedSectionContent = content.slice(headingEnd, sectionEnd);
  
  // Parse list items in the Related section
  const listItemRegex = /^[\s]*[-*+]\s+(.+?)$/gm;
  const listMatches = Array.from(relatedSectionContent.matchAll(listItemRegex));
  
  for (const match of listMatches) {
    const listItem = match[1].trim();
    const parsed = parseRelatedListItem(listItem);
    if (parsed) {
      relatedItems.push(parsed);
    }
  }

  return { relatedItems, hasRelatedHeading, relatedHeadingMatch };
}

/**
 * Parse a single related list item
 * Supports formats like:
 * - friend [[John Doe]]
 * - parent John Doe
 * - sister [[Jane Smith|Jane]]
 */
export function parseRelatedListItem(listItem: string): RelatedListItem | null {
  // Try to match: kind [[link]] or kind [[link|display]]
  const wikiLinkMatch = listItem.match(/^(\w+)\s+\[\[([^\]|]+)(\|[^\]]+)?\]\]\s*$/);
  if (wikiLinkMatch) {
    const [, kind, target] = wikiLinkMatch;
    return {
      kind: kind.trim(),
      target: target.trim()
    };
  }
  
  // Try to match: kind Target Name (without wiki links)
  // Target name should contain at least one letter and be a reasonable name (should contain space or multiple words)
  const plainMatch = listItem.match(/^(\w+)\s+([A-Za-z][\w\s.-]+)$/);
  if (plainMatch) {
    const [, kind, target] = plainMatch;
    const trimmedTarget = target.trim();
    // Reject single words or very short names that look invalid
    if (trimmedTarget.length < 3 || !/\s/.test(trimmedTarget)) {
      return null;
    }
    return {
      kind: kind.trim(),
      target: trimmedTarget
    };
  }
  
  return null;
}

/**
 * Render the Related section with the given relationships
 */
export function renderRelatedSection(relationships: RelatedListItem[]): string {
  if (relationships.length === 0) {
    return '';
  }
  
  const listItems = relationships
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.target.localeCompare(b.target))
    .map(({ kind, target }) => `- ${kind} [[${target}]]`)
    .join('\n');
  
  return `## Related\n\n${listItems}\n`;
}

/**
 * Update the Related section in markdown content
 */
export function updateRelatedSection(content: string, relationships: RelatedListItem[]): string {
  const { hasRelatedHeading, relatedHeadingMatch } = parseRelatedSection(content);
  
  const newRelatedSection = renderRelatedSection(relationships);
  
  if (!hasRelatedHeading) {
    // Add Related section at the end
    if (newRelatedSection) {
      return content.trimEnd() + '\n\n' + newRelatedSection;
    }
    return content;
  }
  
  if (!relatedHeadingMatch) {
    return content; // Should not happen if hasRelatedHeading is true
  }
  
  // Replace existing Related section
  const headingStart = relatedHeadingMatch.index!;
  
  // Find the next heading to determine the end of the Related section
  const headingEnd = headingStart + relatedHeadingMatch[0].length;
  const nextHeadingRegex = /^#{1,6}\s+/gm;
  nextHeadingRegex.lastIndex = headingEnd;
  const nextHeadingMatch = nextHeadingRegex.exec(content);
  
  const sectionEnd = nextHeadingMatch ? nextHeadingMatch.index : content.length;
  
  const before = content.slice(0, headingStart);
  const after = content.slice(sectionEnd);
  
  if (newRelatedSection) {
    return before + newRelatedSection + (after.startsWith('\n') ? after : '\n' + after);
  } else {
    // Remove the Related section entirely if no relationships
    return before + after;
  }
}

/**
 * Clean up multiple Related headings, keeping only one with content
 */
export function cleanupRelatedHeadings(content: string): string {
  const headingRegex = /^(#{1,6})\s+related\s*$/gim;
  const matches = Array.from(content.matchAll(headingRegex));
  
  if (matches.length <= 1) {
    // Fix capitalization of the single Related heading
    const finalHeadingMatch = content.match(/^(#{1,6})\s+related\s*$/im);
    if (finalHeadingMatch) {
      const depth = finalHeadingMatch[1];
      const replacement = `${depth} Related`;
      return content.replace(finalHeadingMatch[0], replacement);
    }
    return content;
  }
  
  // Find which Related section has content
  let contentfulSection: { match: RegExpMatchArray; content: string } | null = null;
  
  for (const match of matches) {
    const headingEnd = match.index! + match[0].length;
    
    // Find the next heading
    const nextHeadingRegex = /^#{1,6}\s+/gm;
    nextHeadingRegex.lastIndex = headingEnd;
    const nextHeadingMatch = nextHeadingRegex.exec(content);
    
    const sectionEnd = nextHeadingMatch ? nextHeadingMatch.index : content.length;
    const sectionContent = content.slice(headingEnd, sectionEnd);
    
    // Check if this section has list items
    const hasListItems = /^[\s]*[-*+]\s+/m.test(sectionContent);
    if (hasListItems && !contentfulSection) {
      contentfulSection = { match, content: sectionContent };
    }
  }
  
  // If no contentful section found, just remove all Related headings except the first
  if (!contentfulSection) {
    let updatedContent = content;
    for (let i = matches.length - 1; i > 0; i--) {
      const match = matches[i];
      const headingStart = match.index!;
      const headingEnd = headingStart + match[0].length;
      
      const nextHeadingRegex = /^#{1,6}\s+/gm;
      nextHeadingRegex.lastIndex = headingEnd;
      const nextHeadingMatch = nextHeadingRegex.exec(updatedContent);
      
      const sectionEnd = nextHeadingMatch ? nextHeadingMatch.index : updatedContent.length;
      
      const before = updatedContent.slice(0, headingStart);
      const after = updatedContent.slice(sectionEnd);
      
      updatedContent = before + after;
    }
    
    // Fix capitalization of the remaining heading
    const finalHeadingMatch = updatedContent.match(/^(#{1,6})\s+related\s*$/im);
    if (finalHeadingMatch) {
      const depth = finalHeadingMatch[1];
      const replacement = `${depth} Related`;
      updatedContent = updatedContent.replace(finalHeadingMatch[0], replacement);
    }
    
    return updatedContent;
  }
  
  // Remove all Related sections except the contentful one
  let updatedContent = content;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (match.index !== contentfulSection.match.index) {
      const headingStart = match.index!;
      const headingEnd = headingStart + match[0].length;
      
      const nextHeadingRegex = /^#{1,6}\s+/gm;
      nextHeadingRegex.lastIndex = headingEnd;
      const nextHeadingMatch = nextHeadingRegex.exec(updatedContent);
      
      const sectionEnd = nextHeadingMatch ? nextHeadingMatch.index : updatedContent.length;
      
      const before = updatedContent.slice(0, headingStart);
      const after = updatedContent.slice(sectionEnd);
      
      updatedContent = before + after;
    }
  }
  
  // Fix capitalization of the remaining Related heading
  const finalHeadingMatch = updatedContent.match(/^(#{1,6})\s+related\s*$/im);
  if (finalHeadingMatch) {
    const depth = finalHeadingMatch[1];
    const replacement = `${depth} Related`;
    updatedContent = updatedContent.replace(finalHeadingMatch[0], replacement);
  }
  
  return updatedContent;
}