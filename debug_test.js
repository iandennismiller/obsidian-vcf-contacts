const error = {"status": "error", "file": "error-contact.md", "message": "No frontmatter found."};
console.log("Error object:", error);
console.log("String contains test:", error.toString().includes('error-contact.md'));
console.log("Object contains test:", JSON.stringify(error).includes('error-contact.md'));
console.log("File property:", error.file);
