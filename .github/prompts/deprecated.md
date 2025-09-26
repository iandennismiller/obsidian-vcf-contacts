
- we must hook sensible obsidian events that only fire at times when it would be useful to update the graph, such as when files are closed or they lose focus
  - if we update the graph on an event like file modification, this causes a cascade of endless contact syncing
- when a user finishes editing a note's Related list, we need to hook an obsidian event that syncs the Related list onto the front matter, which must ultimately propagate to related contacts; a good event would be when a note loses focus. As previously mentioned, a separate mechanism also watches the list while it is being edited and also syncs.

- reuse and extend mdRender() to ensure RELATED front matter is sorted by value
  - also extend mdRender() to produce the Related list in (in sorted order, also)
  - specifically, do not re-implement any method to update front matter when mdRender can be extended instead

## the user experience of using the Related list to manage relationships should be as follows

- when the user opens a contact note, we check to ensure the Related list is current with the front matter
  - if not, propagate the RELATED front matter to the Related list in the note
  - preserve the order of the fields when rendering the list of contacts
  - contacts are rendered as obsidian links to the other contact's note
- when the user clicks or navigates away, or if the document loses focus, we check whether the Related list has changed
  - if yes, propagate new relationships to the graph, and thereafter to the front matter of this contact and any others affected; finally, update other contacts' Related lists
- We can ignore list items that do not parse as "- relationship_kind [[Contact Name]]"
- if there are no new changes to the list, do not attempt to update the graph or the front matter

## we need to be mindful of the VCF folder watcher service, which can create a race condition

- other modules in the plugin could affect fields like REV, including VCF folder watcher
- ensure other modules that might export a VCF will sort the RELATED fields by value
- When VCF Write Back is enabled, then if the note is updated in obsidian, Write Back will update the VCF, which could cause a cascade of changes if it is immediately re-loaded and it differs in some trivial way (like the RELATED headings aren't sorted)
- one possible solution is to debounce the "write back" functionality in the folder watcher

## the flow of information between front matter and Related list depends on the UI event

- when opening a contact note, ensure the front matter is accurately rendered as the Related list
  - on a note open event, the front matter determines how the Related list should look
  - the direction of the information flows from the front matter to the note's Related list
- on a UI event for closing a contact note, if the Related list has changed in a meaningful way, ensure the front matter is updated based on the content of the Related list; the direction of the information is from the note to the front matter
- any time the current contact note loses focus (i.e. change tabs, etc) we should check whether anything has changed and if so, trigger a sync from the Related list to the front matter

## we ultimately want to bundle this code as a pull request for another developer

- Try to minimize changes to existing files because that creates extra work for the original dev.
- For example, instead of specifying a lot of new event handling code in main.ts, move our new changes into a module that focuses on managing just the events that have to do with relationships.
- But we do not need to reimplement anything that was better implemented by the original dev in the plugin; for example extending mdRender to handle sorted RELATED front matter instead of doing it twice.
- Whenever the dev's existing methods can be leveraged to accomplish purposes we require, prefer the dev's methods; this ensures more consistent, backward-compatible behavior.
- In particular, we must be careful about adding new event listeners to implement our UX with great consideration for the event listeners implemented by the original dev.
  - previous iterations of this plugin have created race conditions in which two listeners mutually undo the work of each other, resulting in oscillating variable values across time. This error was very difficult to debug because it only manifests when the code is executed under specific behavioral conditions or user scenarios.

## this is an event-driven workflow

- events may fire in parallel
  - we must use clever locking on global objects like the graph
  - atomic write operations that are globally locked can help prevent some race conditions
- only events initiated by the user can drive our workflow
  - file events like modification are too spammy and they happen when the user does not want it to happen
- Copilot struggles to understand race conditions due to its reliance upon static analysis
- we must develop additional tests that are parameterized by time and user scripts to simulate UI events.
- In particular, we must create test coverage of event listeners through the timelines of typical sequences of user interface behaviors.

## if a VCF file is dropped onto the obsidian vault, copy it to the VCF folder path and remove the original VCF immediately from the vault

- if the VCF already exists in the VCF folder, then check whether any fields are different and modify those on the obsidian contact note; again, remove the VCF that was just dropped from the vault
- debounce the Write Back feature in the VCF folder watcher service; it listens for contact files to be modified and it can update the VCF if there are changes; that should not happen more than once per second
