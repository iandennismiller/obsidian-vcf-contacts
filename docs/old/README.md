# Old Interface Definitions

This directory contains interface definitions that were previously in `/src/interfaces/` but are no longer actively used in the codebase.

## Why These Were Moved

These interfaces were originally created with the intention of defining contracts for the implementation classes. However, in practice:

1. Most of these interfaces are never actually implemented by classes (no `implements` keyword usage)
2. They are not used as type annotations anywhere in the code
3. They were only re-exported from model `index.ts` files but never actually referenced
4. The model classes themselves speak for their own interface through TypeScript's structural typing

## Interfaces Moved Here

The following interface files have been moved to this directory:

- `IConsistencyOperations.ts` - Interface for consistency operations
- `IContactData.ts` - Interface for contact data operations
- `IContactManager.ts` - Interface for contact manager (has duplicate definition in contactManager.ts)
- `IContactManagerData.ts` - Interface for contact manager data
- `IContactManagerUtils.ts` - Interface for contact manager utilities
- `IContactNote.ts` - Interface for contact note operations
- `IMarkdownOperations.ts` - Interface for markdown operations
- `IRelationshipOperations.ts` - Interface for relationship operations
- `ISyncOperations.ts` - Interface for sync operations
- `IVCardCollection.ts` - Interface for VCard collection operations
- `IVCardFile.ts` - Interface for VCard file operations
- `IVCardFileOperations.ts` - Interface for VCard file operations
- `IVCardGenerator.ts` - Interface for VCard generation
- `IVCardManager.ts` - Interface for VCard manager
- `IVCardManagerFileOperations.ts` - Interface for VCard manager file operations
- `IVCardParser.ts` - Interface for VCard parsing
- `IVCardWriteQueue.ts` - Interface for VCard write queue

## What Remains Active

The following definitions are actively used and have been moved to `/src/definitions/`:

- `ContactsPluginSettings.ts` - Plugin settings type (actively used throughout)
- `CuratorProcessor.ts` - Curator processor interface (actively used)
- `CuratorQueItem.ts` - Curator queue item type (actively used)
- `CuratorSettingProperties.ts` - Curator settings type (actively used)
- `RunType.ts` - Run type enum (actively used)

## Note

These files are kept for historical reference and in case they need to be restored. They are not imported or used anywhere in the active codebase.
