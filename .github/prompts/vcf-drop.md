## implement a new feature: if a VCF file is dropped onto the obsidian vault, copy it to the VCF folder path and remove the original VCF immediately from the vault

- if the VCF already exists in the VCF folder, then check whether any fields are different and modify those on the obsidian contact note; again, remove the VCF that was just dropped from the vault
- debounce the Write Back feature in the VCF folder watcher service; it listens for contact files to be modified and it can update the VCF if there are changes; that should not happen more than once per second
