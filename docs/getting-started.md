# Getting Started

## 🛠️ Initial Setup

After installation, follow these steps to start using the VCF Contacts plugin:

### 📁 Set Your Contacts Folder

1. Go to **Settings → VCF Contacts**
2. Set your **Contacts Folder Location** to any existing folder in your vault
3. You're ready to start importing or creating contact notes!

## 📥 Importing vCards (.vcf)

1. Open the **Contacts** sidebar tab
2. Click **Import VCF**
3. Choose a `.vcf` file (single contact or full database)
4. If needed, you'll be prompted to fill in:
   - `Given Name` (First Name)
   - `Family Name` (Last Name)

> These are required to identify and name contact files properly.

## 📤 Exporting Contacts to vCard

1. Select a contact or open the plugin interface
2. Click **Export VCF**
3. Choose a location to save the `.vcf` file (vCard 4.0 format)

## 📂 VCF Folder Watching

**Automatically import new VCF files from a watched folder on your filesystem.**

This feature enables background monitoring of a specified folder for new VCF files, automatically importing any contacts that aren't already in your vault.

### Setup VCF Folder Watching

1. Go to **Settings → VCF Contacts**
2. Scroll to the **VCF Folder Watching** section
3. Configure the following settings:

   - **VCF Watch Folder**: Path to the folder containing VCF files (can be outside your Obsidian vault)
     - Example: `/Users/username/Documents/Contacts` (macOS)
     - Example: `C:\Users\username\Documents\Contacts` (Windows)
     - Example: `/home/username/Documents/Contacts` (Linux)
   
   - **Enable VCF Folder Watching**: Toggle to enable/disable the background monitoring
   
   - **Polling Interval**: How often to check for new files (minimum 10 seconds, default 30 seconds)

### How It Works

- The plugin periodically scans the specified folder for `.vcf` files
- Each VCF file is parsed to extract contact information
- For new contacts (unique UIDs not already in your vault), they are imported automatically
- For existing contacts, the plugin compares REV (revision) timestamps:
  - If the VCF file has a newer REV timestamp than the corresponding Obsidian contact, the contact is updated
  - If the contact name changes during an update, the file is automatically renamed
- File modification times are tracked to avoid re-processing unchanged files
- New contacts are created in your configured contacts folder
- You'll receive notifications when new contacts are imported or existing ones are updated

### Benefits

- **Automated Sync**: No manual importing needed when new VCF files appear
- **Smart Updates**: Automatically updates existing contacts when VCF files have newer revision timestamps
- **Duplicate Prevention**: Uses UID tracking to avoid creating duplicate contacts
- **Intelligent Renaming**: Automatically renames contact files when names change during updates
- **Efficient Processing**: Only processes new or modified files
- **Cross-Platform**: Works with any local filesystem folder
- **Configurable**: Adjust polling frequency based on your needs

> **Note**: The VCF folder can be outside your Obsidian vault, making it easy to sync with external contact management systems or cloud storage folders.

## 🖼️ Adding Avatars

You can add profile photos to your contacts in several ways:

1. **From local files**: Use the avatar picker to select an image file
2. **From URLs**: Enter a direct image URL in the contact's frontmatter
3. **Automatic extraction**: Images embedded in imported VCF files are automatically handled

## ➕ Create a New Contact

1. Open the **Contacts** sidebar
2. Click **New Contact**
3. Fill in the basic information
4. The contact file will be created in your contacts folder

## 🔎 Searching Contacts

Use Obsidian's built-in search or the contacts sidebar to quickly find contacts:

- Search by name, email, phone, or any other field
- Use the contacts list view for browsing
- Leverage Obsidian's powerful search operators

## Next Steps

- Explore the [Feature Overview](features.md) for detailed capabilities
- Learn about [VCard Format](vcard-format.md) for advanced usage
- Check out [Development](development.md) if you want to contribute