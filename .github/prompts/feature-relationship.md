# Feature: Relationship management in Obsidian based on vCard 4.0

- Obsidian is a personal knowledge management system that maintains a "vault" of markdown documents.
- Obsidian provides a robust plugin subsystem with API access to any file in the vault
- These markdown files may include YAML front matter, which obsidian can leverage via API as well as the UI
- Obsidian provides an excellent user experience with many event hooks that plugins can attach to

- The current work involves extending a plugin that offers rudimentary vcard import/export to Obsidian markdown.
- The fields of the vcard are mapped onto YAML front matter during import
  - thereafter the obsidian note has all the info the vcard originally had
  - we treat this as an Obsidian Contact Note, contact, note, markdown file, etc.
- We are adding support for the vcard RELATED field with this plugin
- the remainder of the document explains its expected behavior

## Add support for vcard 4.0 RELATED field, which is used to specify how contacts are related

- the goal of this feature is to enable users to store their own social network locally
- the plugin uses a contacts folder (specified in the settings) to contain markdown files that can be interpreted as contacts
  - the YAML front matter in the markdown contact has a 1:1 mapping with a vcard 4.0 file
- technically, we are projecting a social graph onto a set of vcard files by carefully curating the RELATED fields in those files
- the user experience is like editing any markdown list in obsidian:
  - a contact note contains a heading called Related with a list of relationships under it, as markdown.
  - The user manages the relationships by adding relationships to the list by adding new items to the list like this: `- relationship_kind [[Contact Name]]`; the `[[Contact Name]]` is obsidian-flavored markdown indicating an internal link to a note in the vault called Contact Name
  - The plugin handles the hard part of syncing the user's edits with the graph, then ensuring contacts' front matter and related list match what's in the graph

## The RELATED field in vcard and front matter

- the value of RELATED fields in the front matter conforms to this format: `RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af`
- `urn:uuid:` is one namespace for unambiguously referring to another contact by its UID; prefer this whenever the UID for a contact is a valid UUID
- `name:` is another namespace that is used when the other contact note does not exist in obsidian yet. it would look like `name:First Last`
- `uid:` is used when the vcard has a UID, it is not blank, it is unique, but it is not a valid UUID
- to find the UID for a contact, inspect its front matter of the contact note in obsidian
- we must maintain the RELATED fields in the front matter of the note

## Create a relationship graph using the Graphology library

- the nodes are contacts (identified by UID or fullname if there's no UID); this UID corresponds to the vcard spec; it could be a UUID but possibly not
- the edges indicate relationships between contacts; edges have an attribute that represents the kind of relationship
- two contacts may have multiple relations between them; these are separate edges distinguished by the kind of relation
- edges are directed:
  - a child is related to a parent and it matters who is the child and who is the parent; this is represented as a single edge called "parent" that points to the parent
  - a friendship is implicitly undirected in its interpretation but we represent it in the graph as directed
    - this is also represented as a single edge and if a reciprocal relationship like friendship has a reciprocal edge, merge them so there is never more than one edge of a certain relation type between two nodes
- relationship kinds are genderless
  - if additional information is known about a contact, the relationship kind could be displayed differently
  - but as far as the graph is concerned, the edges are genderless because it's much easier to achieve a consistent graph this way.
- in general, operations that make changes to the graph, front matter, and Related list must be atomic and they must grab a global lock to change the graph, or lock a note to update the front matter and/or related list
- create an obsidian command to manually rebuild the graph from the contacts
- the relationship graph is a stand-alone module focused on graph operations.

## Gender

- vcard 4.0 specifies a separate GENDER field which we must also parse and add to the front matter
  - the types are (M, F, NB, U) corresponding to Male, Female, Non-binary, and Unspecified
- when GENDER is NB, U, blank, or is not present, we would render the relationship kind with a genderless term
- aunt/uncle is internally "auncle" but renders as aunt/uncle if the contact specifies gender
  - if a parent contact has the GENDER value of M, render as "father" in the user interface, etc...
- use genderless relationship kind in front matter, graph, and vcard. It's only when rendering or parsing the Related list that the gender should be encoded/decoded.

## Obsidian front matter is YAML-like

- Obsidian front matter is strictly key-value; no nesting or hierarchy is possible
- front matter fields may contain lists of strings, which we will leverage to store RELATED information
- the key for the set of friends looks like "RELATED[friend]" and each list element is the identifier (UUID, UID, or name) of a contact with this relationship to the current contact (i.e. it starts with urn:uuid:, uid:, or name:)
- within a contact, relationships of the same kind imply a set (e.g. the set of this contact's "friends")
- although the set must be implemented as a list, index is not meaningful
  - we store relationship sets as an array that is sorted by value to permit a deterministic representation
  - when loading/storing these sets, we always sort by value
  - when a set of relationships is mapped onto the front matter, the "array" should remain sorted by value
  - we must also be careful when we parse VCF input to sort the RELATED fields by key and value; the goal is to have a stable data structure in which RELATED arrays stay sorted throughout import/export.
    - if we do change the ordering of RELATED fields as a result of sorting, be sure to update REV

## There must be a strong, deterministic, bidirectional mapping between a contact's front matter and the state of the graph
  
- the Relationship Graph is the authority for all relationship information
- the graph is used to keep the contact front matter in sync
- to create a relationship, first create the edge in the graph; then ensure the front matter of both contacts is updated; then ensure the related list of both contacts contains the relationship

## The primary user interface for curating relationships is the contact note itself

- the plugin adds "## Related" to each contact note
  - there should be exactly one such heading
  - if a contact does not have a Related list when it is opened, then add it
  - if a there are multiple Related headings but one has nothing under it and the other has a list under it, remove the one with no content
  - do not add a Related heading if it already exists
  - the heading should be case insensitive; "## related" is equivalent
  - the depth of the heading is not relevant; works on "### related" too
  - the plugin should fix the capitalization if the user entered it
  - the plugin should clean up extra newlines beneath the Related heading, both before and after the list
  - the plugin should not touch any other heading or anything else in the note
  - or if a relationship change is being propagated to a contact, and a related list is now required for that contact, then add both the "Related" heading and create the list beneath it.
- a list under the Related heading maps onto the RELATED items in the front matter of the contact note
  - a relationship is a triple consisting of (subject, relationship kind, object)
  - on a contact note, the subject is always the current contact; therefore relationships can be specified as tuples: (kind, object)
  - in markdown, this may be rendered in a list item like "- friend [[First Last]]"
  - the object, appearing in double-square brackets is an obsidian-flavored markdown link to a contact called "First Last"
  - if the object's note exists as a contact, then the UID in its front matter serves as the identifier for that contact in the front matter and the graph; however it renders in the Related list as the human-readable contact name (which is also the name of the contact note in obsidian).
  - if the user specifies a gendered relationship type, attempt to infer the gender to update the other contact with that info; then set the edge according to the genderless kind
    - detect mom/mother/etc and update other contact's GENDER in front matter; relation kind is parent
    - similarly, dad/father/etc implies GENDER of other contact; update its front matter
    - sister, brother, son, daughter, and so on.
    - like any other change to the front matter, this updates the REV as well
- altogether, the plugin identifies a heading called "Related" that has a list under it; the list consists of tuples specifying how this contact is related to other contacts
- the plugin must establish a bidirectional mapping from RELATED front matter items onto the markdown Related list
- this feature must not touch any other headings or other parts of the document; just the list under the Related heading.

## relationship updates must be propagated carefully through the graph

- when one relationship edge is created or changed, this actually affects two contacts: the subject and the object; they must both be updated
- before changing the front matter of any contact, verify whether anything would change; if not, do not change anything
- we must be sure the method to sync from the Related list to the front matter is debounced or uses a locking mechanism; otherwise, multiple events could cause sync to run in parallel with unexpected results.
- to ensure consistency, all these operations must work through the graph as the intermediate data representation:
  - the active contact's markdown list updates the graph, which is the source of truth about relationships
  - then the graph updates the front matter for all affected contacts (if anything changed)
  - finally the Related heading can be re-rendered on other contacts if anything changed
- when updates are propagated, there is a risk of cascading events; ensure each contact is processed only one time
- create an obsidian command to manually trigger this synchronization.

## opening a contact in obsidian

- when the user opens a contact note in obsidian (i.e. with UI events)
  - if any relations appear in the front matter but not the Related list, then add the missing ones to the Related list
  - do not remove based on non-presence; only add
  - next if the Related list has relations that are not present in the front matter, add the missing ones to the front matter

## closing a contact note in obsidian

- when the user closes a contact note in obsidian (i.e. with UI events)
  - this goes in the reverse order of opening
  - first, if the Related list has relations that are not present in the front matter, add the missing ones to the front matter
  - then, if any relations appear in the front matter but not the Related list, then add the missing ones to the Related list
  - as before, do not remove based on non-presence; only add

## vcard uses the REV field to determine how recently information was updated

- REV is a timestamp field in the vcard formatted like `20250925T141344Z` that indicates when the information most recently changed.
- any time we change the front matter of a contact, we must update the REV field in the front matter
- we must debounce updating the REV field so this does not occur repeatedly
- be sure REV does not update unless the front matter actually changed

## we need a method for checking every node in our graph and every contact in our vault to ensure the front matter of each is in sync with the graph (i.e. graph is consistent with front matter)

- we must handle the scenario in which the relationships are inconsistent.
  - Let's say a relationship is added to a contact but the other contact was never updated with the reciprocal RELATED field in the front matter.
  - When the plugin initializes, it should also check the graph for consistency, specifically finding and correcting missing RELATED backlinks that should be in the front matter.
  - A friends B; if A's front matter includes B in their RELATED[friend], but B's front matter does not include A, this is inconsistent; the fix is to add A to B's front matter.
- the relationship graph itself should not have reciprocal links of the same kind; but the contacts do have reciprocal links
  - A friends B; if we find another edge B friends A, that is inconsistent; to fix it we would remove one edge or the other
- in general, if one contact indicates a relationship with another, but the other contact is missing a reciprocal RELATED front matter field, then add the relation to that contact's front matter
- while this scenario could also happen because a relationship is deleted (i.e. it is removed from one contact and the expected behavior is to propagate), we nevertheless do not remove information by default; only add
- consistency checks must not run in parallel; only one can run at a time and it should be globally locked
