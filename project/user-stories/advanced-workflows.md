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

**As a user**, I want to track when contact information was last updated so that I can see the freshness of my contact data and maintain version consistency between Obsidian and VCF files.

**Test Location**: `tests/stories/contactVersioning.spec.ts`

**Related Specifications**: [Relationship Management Specification](../specifications/relationship-management.md#the-rev-field)

## 22. Integration Workflows

**As a user**, I want to integrate this plugin with my existing contact management workflow, including address books, CRM systems, and mobile devices that support vCard import/export.

**Test Location**: `tests/stories/integrationWorkflows.spec.ts`

## 23. Configurable Folder and Filename Settings

**As a user**, I want to control where my VCF files are stored and configure which files to ignore during sync, so that I can organize my contacts in a way that fits my workflow.

**Test Location**: `tests/stories/configurableSettings.spec.ts`

**Related Specifications**: [VCF Sync Specification](../specifications/vcf-sync.md)

## 24. Manual Relationship Synchronization

**As a user**, I want a command to manually trigger relationship synchronization across all contacts, ensuring that all bidirectional relationships are consistent and properly propagated through the graph.

**Test Location**: `tests/stories/manualRelationshipSync.spec.ts`

## 25. Manual Curator Processor Execution

**As a user**, when I manually invoke curator processors on a contact, I expect missing relationships from the Related section to be added to frontmatter so that my contact data stays consistent.

**Test Location**: `tests/stories/manualCuratorExecution.spec.ts`

**Related Specifications**: [Curator Pipeline Specification](../specifications/curator-pipeline.md)

## 26. Curator Pipeline Integration and Sequential Execution

**As a user**, I expect the curator processing pipeline to maintain data integrity so that when multiple processors run, all changes are preserved and I don't lose data.

**Test Location**: `tests/stories/curatorPipelineIntegration.spec.ts`

**Related Specifications**: [Curator Pipeline Specification](../specifications/curator-pipeline.md)

---

**Related Specifications**: 
- [Curator Pipeline Specification](../specifications/curator-pipeline.md)
