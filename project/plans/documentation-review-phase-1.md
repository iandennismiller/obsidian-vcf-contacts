# Documentation Review - Phase 1: Specification Cleanup

## Objective

Review and refine `/project/specifications` to remove descriptions of idiosyncratic behaviors that have been replaced by 3rd party libraries. Focus on ensuring specifications describe what the plugin does (domain logic, Obsidian integration) rather than how standard formats are parsed/generated (which is delegated to libraries).

## Current State Analysis

### Libraries Actually Used (Confirmed)

1. **vcard4** (`from 'vcard4'`) - Used in:
   - `src/models/vcardFile/parsing.ts` - VCF parsing
   - `src/models/vcardFile/generation.ts` - VCF generation

2. **marked** (`from 'marked'`) - Used in:
   - `src/models/contactNote/relationshipOperations.ts` - Relationship list parsing
   - `src/models/contactNote/contactSectionOperations.ts` - Contact section parsing
   - `src/models/contactNote/baseMarkdownSectionOperations.ts` - Base markdown operations

3. **flat** (`from 'flat'`) - Used in:
   - `src/models/vcardFile/parsing.ts` - Object flattening for frontmatter
   - `src/models/vcardFile/generation.ts` - Object unflattening from frontmatter

4. **yaml** (`from 'yaml'`) - Used in:
   - `src/models/contactNote/contactData.ts` - YAML parsing/stringifying
   - `src/models/contactNote/markdownOperations.ts` - YAML stringifying

### Custom Implementations Still Present

1. **UUID Generation** - Custom implementation in `src/curators/uidValidate.tsx`:
   - Zero-dependency UUID generator
   - NOT using a library like 'uuid'
   - This is intentional and documented as "Zero dependency uuid generator"

2. **Field Pattern Detection** - Custom implementation in `src/models/contactNote/fieldPatternDetection.ts`:
   - Email pattern detection
   - Phone number normalization
   - URL detection
   - Address parsing
   - This is domain-specific logic, NOT library functionality

3. **Relationship Type Processing** - Custom implementation:
   - Gender-aware relationship rendering
   - Genderless relationship storage
   - Bidirectional relationship sync
   - This is plugin-specific business logic

4. **Contact Section Parsing** - Uses marked for structure, custom logic for:
   - Field type detection (email, phone, URL, address)
   - Kind/type prefix extraction
   - Value normalization
   - Frontmatter key generation

## Issues Identified in Specifications

### 1. library-integration-spec.md
- ✅ CORRECT: Properly documents library responsibilities vs custom code
- ✅ CORRECT: Clearly separates concerns
- Status: **Needs minor refinement only**

### 2. vcard-format-spec.md
- ❌ ISSUE: Still contains descriptions of custom parsing/generation logic that's now handled by vcard4
- ❌ ISSUE: References to "parseKey" which doesn't exist in the codebase
- Status: **Needs significant cleanup**

### 3. contact-section-spec.md
- ⚠️ MIXED: Correctly documents marked usage, but contains overly detailed pattern detection specs
- ⚠️ MIXED: Field detection patterns should reference code, not duplicate implementation
- Status: **Needs moderate refinement**

### 4. relationship-management-spec.md
- ⚠️ MIXED: Correctly notes marked usage, but still has some low-level details
- ⚠️ MIXED: Some references to "flat library" handling that's already documented in library-integration-spec
- Status: **Needs moderate refinement**

### 5. vcf-sync-spec.md
- ✅ MOSTLY CORRECT: High-level enough, focuses on sync strategy
- Status: **Needs minor refinement only**

## Phase 1 Plan

### Tasks

- [x] Initial repository exploration
- [x] Identify libraries actually in use
- [x] Identify custom implementations
- [x] Document current state
- [ ] Refine vcard-format-spec.md (remove duplicate library documentation)
- [ ] Refine contact-section-spec.md (remove overly detailed implementation specs)
- [ ] Refine relationship-management-spec.md (reduce redundant library references)
- [ ] Ensure all specs reference library-integration-spec.md appropriately
- [ ] Review for consistency across all specification files
- [ ] Create summary document of changes

### Principles for Refinement

1. **Delegate to Library Specs**: If vcard4, marked, flat, or yaml handles it, reference library-integration-spec.md, don't duplicate
2. **Focus on Domain Logic**: Specs should describe plugin-specific business rules, not library mechanics
3. **Keep Custom Logic**: Document custom implementations (UUID generation, field detection, relationship logic)
4. **Reduce Complexity**: Remove low-level implementation details that duplicate what's in the code
5. **Maintain Accuracy**: Ensure specs match actual implementation

### Success Criteria

- Specifications accurately reflect library usage
- No duplication between library-integration-spec.md and other specs
- Focus on what makes this plugin unique (Obsidian integration, relationship management)
- Clear separation between standard format handling (libraries) and domain logic (plugin)

## Next Steps

1. Create detailed review of each specification file
2. Make surgical edits to remove library implementation details
3. Ensure cross-references are correct
4. Validate against actual codebase
