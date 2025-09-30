import { Notice, Platform, TFile } from "obsidian";
import { getSettings } from "src/plugin/context/sharedSettingsContext";

/* istanbul ignore next */
// File picker UI operations depend on browser DOM APIs and user interaction
/**
 * Opens a file picker for selecting files
 * Moved from src/file/file.ts
 */
export async function openFilePicker(type: string): Promise<string | Blob> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type;
    input.style.display = "none";

    input.addEventListener("change", () => {
      if (input?.files && input.files.length > 0) {
        const file = input.files[0];

        const isImage = type === 'image/*' || type.startsWith('image/');
        if (isImage) {
          resolve(file); // Return the File for image use
        } else {
          const reader = new FileReader();

          reader.onload = function (event) {
            const rawData = event?.target?.result || '';
            if (typeof rawData === "string") {
              resolve(rawData);
            } else {
              resolve(new TextDecoder("utf-8").decode(rawData));
            }
          };

          reader.readAsText(file, "UTF-8");
        }
      } else {
        resolve('');
      }
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

/**
 * Save vCard file using browser download or mobile file system
 * Moved from src/file/file.ts
 */
export function saveVcardFilePicker(data: string, obsidianFile?: TFile): void {
  try {
    const file = new Blob([data], { type: "text/vcard" });
    const filename = obsidianFile ? obsidianFile.basename.replace(/ /g, '-') + '.vcf' : "shared-contacts.vcf";
    const fileObject = new File([file], filename, { type: "text/vcard" });

    /**
     * Warning we are hooking into obsidian implementation (capacitor)
     * This dependency can change at any point but there is no alternative
     * found that can actually share without extra user click on IOS and Android
    **/
    // @ts-ignore
    if(Platform.isMobileApp && window.Capacitor && typeof window.Capacitor.Plugins.Filesystem.open === 'function') {
      (async () => {
        try {
          // @ts-ignore
          await window.Capacitor.Plugins.Filesystem.writeFile({
            path: filename,
            data,
            directory: 'DOCUMENTS',
            encoding: 'utf8'
          });
          if(Platform.isAndroidApp) {
            new Notice(`Saved to /Documents on device:\n${filename}\nOpen the Files app to share with other applications`);
          } else {
            new Notice(`\`Saved to your device's Files app under this app:\n${filename}\nOpen the Files app to share with other applications`);
          }
        } catch (e) {
          console.log(e);
        }
      })();

    } else {
      // desktopApp
      const element = document.createElement("a");
      element.href = URL.createObjectURL(fileObject);
      element.download = filename;
      element.click();
    }

  } catch (err) {
    console.log("Failed to share or save VCard", err);
  }
}

/**
 * Check if a file is in the contacts folder
 * Moved from src/file/file.ts
 */
export function isFileInFolder(file: TFile): boolean {
  const settings = getSettings();
  return file.path.startsWith(settings.contactsFolder);
}