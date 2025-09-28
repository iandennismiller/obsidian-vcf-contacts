# Reciprocal Relationships Feature

This feature adds automatic detection and fixing of missing reciprocal relationships in the Obsidian VCF Contacts plugin.

## New Obsidian Commands

### 1. Check reciprocal relationships
**Command ID:** `check-reciprocal-relationships`

- Analyzes the current contact's relationships in the Related list
- For each relationship, checks if the target contact has a reciprocal relationship back
- Reports any missing reciprocal relationships

**Example:**
- John has `- parent [[Jane Doe]]` in his Related list
- Command checks if Jane has `- child [[John Doe]]` in her Related list or frontmatter
- Reports missing reciprocals for manual review

### 2. Fix missing reciprocal relationships  
**Command ID:** `fix-missing-reciprocal-relationships`

- Identifies missing reciprocal relationships (same as check command)
- Automatically adds the missing reciprocal relationships to target contacts
- Syncs the new relationships to both Related list and frontmatter

**Example:**
- Finds that Jane is missing `- child [[John Doe]]`
- Automatically adds it to Jane's Related list
- Syncs to Jane's frontmatter as `RELATED[child]: name:John Doe`

## Relationship Type Mapping

### Asymmetric Relationships (different reciprocal types)
- `parent` ↔ `child`
- `grandparent` ↔ `grandchild`  
- `auncle` (aunt/uncle) ↔ `nibling` (niece/nephew)

### Symmetric Relationships (same reciprocal type)
- `friend` ↔ `friend`
- `spouse` ↔ `spouse`
- `sibling` ↔ `sibling`
- `partner` ↔ `partner`
- `colleague` ↔ `colleague`
- `relative` ↔ `relative`
- `cousin` ↔ `cousin`

## Implementation Details

- **Integration**: Seamlessly integrates with existing relationship sync system
- **Type Handling**: Uses same relationship type normalization (gendered → genderless)
- **Format Respect**: Respects existing frontmatter format and indexing rules
- **Timestamps**: Maintains REV timestamp updates for changed contacts
- **Error Handling**: Provides detailed error reporting and logging
- **Edge Cases**: Handles missing contacts, invalid relationships, etc.

## Usage Scenarios

1. **Family Tree Consistency**: Ensure parent-child relationships are bidirectional
2. **Social Network Maintenance**: Keep friend relationships synchronized  
3. **Professional Network Sync**: Maintain colleague relationships consistently

## Files Added

- `src/util/reciprocalRelationships.ts` - Core reciprocal relationship functionality
- `tests/reciprocalRelationshipsCore.spec.ts` - Core function tests
- `tests/reciprocalRelationshipsDemo.spec.ts` - Demonstration tests
- Commands added to `src/main.ts` for Obsidian integration

## Testing

Run the tests with:
```bash
npm run test -- reciprocalRelationshipsCore reciprocalRelationshipsDemo
```

All tests pass and demonstrate the functionality working correctly.