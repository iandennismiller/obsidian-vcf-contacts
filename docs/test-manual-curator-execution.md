# Manual Curator Processor Execution - User Story Test

## Overview

This document describes the user story test created to validate the behavior when manually invoking the "Run curator processors on current contact" command.

## User Story

**As a user**, when I manually invoke the command "Run curator processors on current contact" and there are items in the Related list that are not in the front matter, **I expect** that the missing relationships will be added to the frontmatter.

## Test Location

`tests/stories/manualCuratorProcessorExecution.spec.ts`

## Test Scenarios

### 1. Primary Scenario: Adding Missing Relationships

**Given** a contact with relationships in the Related section but not in frontmatter:
```markdown
---
UID: john-uid-123
FN: John Doe
---

#### Related
- spouse: [[Jane Smith]]
- friend: [[Bob Jones]]
```

**When** the RelatedListProcessor is manually invoked

**Then** the processor should:
- Add both missing relationships to frontmatter
- Use proper UID-based references (e.g., `urn:uuid:jane-uid-456`)
- Update the REV timestamp
- Return a CuratorQueItem with success message

### 2. Partial Sync Scenario

**Given** a contact with one relationship in frontmatter and two in the Related section

**When** the processor is run

**Then** only the missing relationship should be added to frontmatter

### 3. No-Op Scenario

**Given** a contact where Related section and frontmatter are already in sync

**When** the processor is run

**Then** the processor should return `undefined` (no action needed)

### 4. REV Timestamp Update

**Given** any contact with missing relationships

**When** relationships are added

**Then** the REV timestamp should be updated to the current time

### 5. Edge Case: No Related Section

**Given** a contact with no Related section

**When** the processor is run

**Then** the processor should return `undefined` gracefully

## Implementation Validation

The test confirms that the existing `RelatedListProcessor` implementation correctly:

1. ✅ Parses relationships from the Related markdown section
2. ✅ Compares with existing frontmatter relationships
3. ✅ Identifies missing relationships accurately
4. ✅ Resolves contact names to UIDs for proper references
5. ✅ Updates only when changes are needed
6. ✅ Updates REV timestamp appropriately
7. ✅ Returns meaningful feedback via CuratorQueItem

## Running the Test

```bash
npm test -- tests/stories/manualCuratorProcessorExecution.spec.ts
```

## Test Results

All 5 test scenarios pass successfully, validating that the manual curator processor execution works as expected for the user story.
