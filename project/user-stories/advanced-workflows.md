# Advanced Workflow User Stories

Stories related to complex workflows, bulk operations, and system integration.

## 18. Bulk Contact Operations

**As a user**, I want to perform bulk operations like syncing all contacts, validating all relationships, or updating all VCF files from my Obsidian contacts at once.

**Test Location**: `tests/stories/bulkOperations.spec.ts`

## 19. Contact Validation and Integrity

**As a user**, I want the plugin to validate that all relationship references point to existing contacts and warn me about broken links or missing contacts.

**Test Location**: `tests/stories/contactValidation.spec.ts`

## 20. Selective Field Synchronization  

**As a user**, I want to control which fields sync between Obsidian and VCF files, so I can keep some information private to Obsidian while sharing basic contact info via VCF.

**Test Location**: `tests/stories/selectiveFieldSync.spec.ts`

## 21. Contact History and Versioning

**As a user**, I want to track when contact information was last updated (REV field) and maintain version consistency between Obsidian and VCF files. The REV field is a timestamp in the format `20250925T141344Z` that indicates when the information most recently changed. The plugin automatically updates REV whenever frontmatter changes, but only if the data actually changed, preventing unnecessary updates.

**Test Location**: `tests/stories/contactVersioning.spec.ts`

## 22. Integration Workflows

**As a user**, I want to integrate this plugin with my existing contact management workflow, including address books, CRM systems, and mobile devices that support vCard import/export.

**Test Location**: `tests/stories/integrationWorkflows.spec.ts`

## 23. Configurable Folder and Filename Settings

**As a user**, I want to control the folder or filename in the configuration settings; the rest of the plugin should make reference to these values as appropriate. When I select the VCF Folder storage method and enable the "Customize Ignore List" toggle, I expect to see input fields for specifying UIDs and filenames to ignore during sync. These ignore list settings should become visible immediately when I enable the customization toggle, without requiring any other settings to be enabled first.

**Test Location**: `tests/stories/configurableSettings.spec.ts`

## 24. Manual Relationship Synchronization

**As a user**, I want a command to manually trigger relationship synchronization across all contacts, ensuring that all bidirectional relationships are consistent and properly propagated through the graph.

**Test Location**: `tests/stories/manualRelationshipSync.spec.ts`

## 25. Manual Curator Processor Execution

**As a user**, when I manually invoke the command "Run curator processors on current contact" and there are items in the Related list that are not in the front matter, **I expect** that the missing relationships will be added to the frontmatter. The processor should:

- Parse relationships from the Related markdown section
- Compare with existing frontmatter relationships
- Identify missing relationships accurately
- Resolve contact names to UIDs for proper references
- Update only when changes are needed
- Update REV timestamp appropriately
- Return meaningful feedback about changes made

**Test scenarios:**
1. **Adding Missing Relationships**: When a contact has relationships in the Related section but not in frontmatter, the processor should add both missing relationships to frontmatter using proper UID-based references (e.g., `urn:uuid:jane-uid-456`) and update the REV timestamp
2. **Partial Sync**: When a contact has one relationship in frontmatter and two in the Related section, only the missing relationship should be added to frontmatter
3. **No-Op**: When Related section and frontmatter are already in sync, the processor should return `undefined` (no action needed)
4. **REV Timestamp Update**: When relationships are added, the REV timestamp should be updated to the current time
5. **No Related Section**: When a contact has no Related section, the processor should return `undefined` gracefully

**Test Location**: `tests/stories/manualCuratorExecution.spec.ts`

## 26. Curator Pipeline Integration and Sequential Execution

**As a user**, I expect the curator processing pipeline to maintain data integrity throughout all processing steps. When multiple curator processors run on the same contact:

- Each processor's changes should be preserved and not overwritten by other processors
- Processors should run sequentially (not concurrently) to prevent race conditions
- State changes should flow correctly between processors
- The final state should include changes from all processors
- No data should be lost due to concurrent writes

**Expected behavior:**
- When Processor A adds `RELATED[friend]` to frontmatter and Processor B adds `TEST_FIELD`, the final frontmatter should contain both changes
- If processors run concurrently and overwrite each other's changes, this is a **bug** that causes users to see changes appear then disappear
- The pipeline should be deterministic - running processors multiple times on the same contact should produce stable results
- Existing RELATED keys should be preserved when new relationships are added
- The system should handle contacts with no initial RELATED frontmatter correctly on the first run (not requiring multiple runs)

**Test Location**: `tests/stories/curatorPipelineIntegration.spec.ts`

---

**Related Specifications**: 
- [Curator Pipeline Specification](../specifications/curator-pipeline-spec.md)
