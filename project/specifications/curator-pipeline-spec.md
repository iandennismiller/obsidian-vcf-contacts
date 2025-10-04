# Curator Pipeline Specification

## Overview

The curator pipeline is a processor-based system for contact operations. Processors run sequentially to maintain data integrity and prevent race conditions.

## Curator Manager

The CuratorManager coordinates processor execution:
- Maintains a queue of contacts to process
- Executes processors in defined order
- Ensures sequential execution (no concurrency)
- Tracks processor dependencies
- Manages processor lifecycle

## Processor Types

Processors are classified by when they run:

### IMMEDIATELY Processors

Run as soon as contact data changes:
- High priority operations
- Critical for data consistency
- Examples: UID assignment, REV updates

### UPCOMING Processors

Run on a schedule or when triggered:
- Medium priority operations
- Can be deferred slightly
- Examples: Relationship sync, gender inference

### IMPROVEMENT Processors

Run periodically for data quality:
- Low priority operations
- Nice-to-have enhancements
- Examples: De-duplication, validation

## Sequential Execution

Processors must run sequentially to prevent data loss:

### The Problem

If processors run concurrently:
1. Processor A reads contact data
2. Processor B reads contact data
3. Processor A makes changes, writes contact
4. Processor B makes changes, writes contact
5. **Result**: Processor A's changes are lost!

### The Solution

Processors run in sequence:
1. Processor A reads contact data
2. Processor A makes changes, writes contact
3. Processor B reads contact data (including A's changes)
4. Processor B makes changes, writes contact
5. **Result**: Both changes are preserved!

## Processor Interface

Each processor implements the CuratorProcessor interface:

```typescript
interface CuratorProcessor {
  name: string;
  runType: RunType;
  dependencies?: string[];
  
  process(contact: ContactNote): Promise<ProcessResult | undefined>;
}
```

### Process Method

Returns `ProcessResult` if changes were made, `undefined` if no changes needed.

```typescript
interface ProcessResult {
  success: boolean;
  message?: string;
  changes?: FieldChange[];
}
```

## Standard Processors

### uidProcessor

- **Type**: IMMEDIATELY
- **Purpose**: Ensure every contact has a UID
- **Runs**: When contact is created or UID is missing
- **Changes**: Adds UID field if missing

### relatedFrontMatterProcessor

- **Type**: UPCOMING
- **Purpose**: Sync relationships from Related list to frontmatter
- **Runs**: After Related list is edited
- **Changes**: Adds missing relationships to frontmatter
- **Dependencies**: None

### relatedListProcessor

- **Type**: UPCOMING
- **Purpose**: Sync relationships from frontmatter to Related list
- **Runs**: After frontmatter is edited
- **Changes**: Adds missing relationships to Related list
- **Dependencies**: None

### genderInferenceProcessor

- **Type**: UPCOMING
- **Purpose**: Infer gender from relationship terms
- **Runs**: After Related list changes with gendered terms
- **Changes**: Updates GENDER field on related contacts
- **Dependencies**: relatedFrontMatterProcessor

### genderRenderProcessor

- **Type**: UPCOMING
- **Purpose**: Render relationships with gender-specific terms
- **Runs**: Before displaying Related list
- **Changes**: Converts genderless types to gendered terms
- **Dependencies**: genderInferenceProcessor

### relationshipDeduplicationProcessor

- **Type**: IMPROVEMENT
- **Purpose**: Remove duplicate relationships
- **Runs**: Periodically or on demand
- **Changes**: Removes exact duplicates and gendered/ungendered pairs
- **Dependencies**: relatedFrontMatterProcessor, relatedListProcessor

## State Management

Processors maintain state through ContactData:

1. **Read Phase**: Processor reads current contact data
2. **Process Phase**: Processor determines what changes to make
3. **Write Phase**: Processor updates contact data
4. **Commit Phase**: Contact data is written to file

All processors working on the same contact share the same ContactData instance, ensuring changes are visible to subsequent processors.

## Error Handling

Processor errors are handled gracefully:
- Processor exceptions are caught and logged
- Failed processor doesn't block subsequent processors
- User is notified of processor failures
- Contact data remains in consistent state

## Manual Invocation

Users can manually trigger processors:
- Command: "Run curator processors on current contact"
- Command: "Run curator processors on all contacts"
- Processors run in standard order
- Results are reported to user

## Pipeline Guarantees

The curator pipeline guarantees:
1. **Sequential Execution**: Processors run one at a time
2. **State Preservation**: Changes from earlier processors are visible to later ones
3. **Deterministic Results**: Same input produces same output
4. **No Data Loss**: All processor changes are preserved
5. **Idempotence**: Running processors multiple times is safe

## Related Specifications

- [Relationship Management Specification](relationship-management-spec.md)
- [Gender Processing Specification](gender-processing-spec.md)
