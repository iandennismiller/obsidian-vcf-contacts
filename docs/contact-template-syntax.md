# Contact Section Template Syntax

The Contact section template uses a simple template language inspired by Mustache and Jinja2 that allows you to control how contact information is displayed.

## Overview

Templates consist of regular text mixed with template tags. Tags are enclosed in double curly braces: `{{TAG}}`.

## Template Tags

### Section Tags

Section tags define blocks of content that are only rendered if the corresponding field type has data.

**Syntax:**
```
{{#FIELDTYPE}}
  content here
{{/FIELDTYPE}}
```

**Available Field Types:**
- `EMAIL` - Email addresses
- `TEL` - Phone numbers
- `ADR` - Physical addresses
- `URL` - Websites/URLs

**Example:**
```
{{#EMAIL}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}
{{/EMAIL}}
```

This section only renders if the contact has at least one email address.

### Display Control Tags

Control how many fields are displayed within a section.

**`{{#FIRST}}...{{/FIRST}}`**
- Shows only the first field of a given type
- Useful for showing primary contact information only

**`{{#ALL}}...{{/ALL}}`**
- Shows all fields of a given type
- Useful for comprehensive contact information

**Example:**
```
{{#TEL}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}
{{/TEL}}
```

To show all phone numbers instead:
```
{{#TEL}}
📞 Phone
{{#ALL}}{{LABEL}} {{VALUE}}
{{/ALL}}
{{/TEL}}
```

### Variable Tags

Variable tags are replaced with actual values from the contact data.

**Common Variables:**
- `{{LABEL}}` - Field label (e.g., "Home", "Work", "Cell") in title case
- `{{VALUE}}` - Field value (email address, phone number, URL)

**Address Variables:**
- `{{STREET}}` - Street address
- `{{LOCALITY}}` - City/locality
- `{{REGION}}` - State/province/region
- `{{POSTAL}}` - Postal/ZIP code
- `{{COUNTRY}}` - Country

**Example:**
```
{{#EMAIL}}
📧 Email
{{#ALL}}{{LABEL}}: {{VALUE}}
{{/ALL}}
{{/EMAIL}}
```

## Newline Suppression

When a tag is suffixed with a hyphen (`-`), newlines immediately following the closing tag are suppressed during rendering. This feature is inspired by Jinja2's whitespace control and applies **regardless of whether the section contains data or not**.

**Syntax:**
```
{{#FIELDTYPE-}}
  content
{{/FIELDTYPE-}}
```

**Behavior:**
- **Without hyphen:** Newlines after the closing tag are preserved
- **With hyphen:** Newlines immediately after the closing tag are removed

**Example without hyphen:**
```
{{#EMAIL}}
{{LABEL}}
{{/EMAIL}}
```
The newline after `{{/EMAIL}}` is preserved in the output.

**Example with hyphen:**
```
{{#EMAIL-}}
{{LABEL}}
{{/EMAIL-}}
```
The newline after `{{/EMAIL-}}` is removed from the output.

**Important:** The hyphen suffix controls whitespace **unconditionally**. It removes trailing newlines whether or not the section has data. This gives you precise control over spacing in your template.

**Practical Use Case:**

Without hyphen suppression, sections can create unwanted whitespace:
```
{{#EMAIL}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL}}
{{#TEL}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL}}
```

Even if the contact has both email and phone, there's a blank line between the closing `{{/EMAIL}}` and opening `{{#TEL}}` tags.

With hyphen suppression, you have precise control:
```
{{#EMAIL-}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
{{#TEL-}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL-}}
```

Now the newline after each closing tag is suppressed, allowing you to control spacing through the blank lines explicitly written in your template content, not from the tags themselves.

## Default Template

The default template shows the first field of each type with icons:

```
{{#EMAIL-}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
{{#TEL-}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL-}}
{{#ADR-}}
🏠 Address
{{#FIRST}}({{LABEL}})
{{STREET}}
{{LOCALITY}}, {{REGION}} {{POSTAL}}
{{COUNTRY}}

{{/FIRST}}
{{/ADR-}}
{{#URL-}}
🌐 Website
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/URL-}}
```

## Customization Examples

### Show All Email Addresses

```
{{#EMAIL-}}
📧 Email
{{#ALL}}{{LABEL}} {{VALUE}}
{{/ALL}}

{{/EMAIL-}}
```

### Remove Icons

```
{{#EMAIL-}}
Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
{{#TEL-}}
Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL-}}
```

### Add Colons After Labels

```
{{#EMAIL-}}
📧 Email
{{#FIRST}}{{LABEL}}: {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
```

### Reorder Field Types

Put phone numbers first:

```
{{#TEL-}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL-}}
{{#EMAIL-}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
```

### Hide Field Types

Only show email and phone (omit address and URL sections entirely):

```
{{#EMAIL-}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
{{#TEL-}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL-}}
```

### Custom Formatting with Bullets

```
{{#EMAIL-}}
📧 Email
{{#ALL}}- {{LABEL}}: {{VALUE}}
{{/ALL}}

{{/EMAIL-}}
```

### Compact Format (No Labels)

```
{{#EMAIL-}}
📧 {{VALUE}}
{{/EMAIL-}}
{{#TEL-}}
📞 {{VALUE}}
{{/TEL-}}
```

## Notes

- Labels are automatically formatted to title case (e.g., "HOME" becomes "Home")
- Numeric index prefixes are automatically stripped (e.g., "1:WORK" becomes "Work")
- The template is processed in the order you write it, so field type order matches your template order
- Empty sections (no data) produce no output when using hyphen suppression
- All template tags are case-sensitive

## Technical Details

### Processing Order

1. Template is loaded with user customizations
2. Frontmatter is parsed into field groups (EMAIL, TEL, ADR, URL)
3. Labels are formatted (title case, strip numeric indices)
4. Section tags are processed for each field type
5. Display control tags (FIRST/ALL) are processed within sections
6. Variable tags are replaced with actual values
7. Newline suppression is applied for tags with hyphens
8. Any remaining template tags are removed
9. Final output is trimmed and returned

### Escaping

Currently, there is no escaping mechanism. If you need to display literal text that looks like a template tag, consider using alternative characters or formatting.
