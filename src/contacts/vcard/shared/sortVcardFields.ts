import { VCardForObsidianRecord } from "src/contacts/vcard";

/**
 * Extracts the base key from a vCard field name.
 * - If the key contains `[`, extract everything before it.
 * - Else if the key contains `.`, extract everything before the first dot.
 * - Otherwise, return the key as is.
 * @param key The full vCard field key.
 * @returns The extracted base key.
 */
function extractBaseKey(key: string): string {
  if (key.includes("[")) {
    return key.split("[")[0];
  } else if (key.includes(".")) {
    return key.split(".")[0];
  }
  return key;
}


/**
 * Sorts a vCard object:
 * - Moves priority fields (e.g., `N`, `FN`, `EMAIL`, `TEL`) to the top.
 * - Places `ADR` fields **after** `BDAY`.
 * - Sorts indexed fields (`[1:]`, `[1:TYPE]`) in order.
 * @param vCardObject The parsed vCard object.
 * @returns A sorted vCard object.
 */
export function sortVCardOFields(vCardObject: VCardForObsidianRecord): VCardForObsidianRecord {
  // Define sorting priority
  const priorityOrder = [
    "N", "FN", "PHOTO",
    "EMAIL", "TEL",
    "BDAY",
    "ADR", "URL",
    "ORG", "TITLE", "ROLE"
  ];

  // Separate priority and other fields
  const priorityEntries: VCardForObsidianRecord = {};
  const adrEntries: VCardForObsidianRecord = {};
  const otherEntries: VCardForObsidianRecord = {};

  Object.entries(vCardObject).forEach(([key, value]) => {
    const baseKey = extractBaseKey(key);

    if (priorityOrder.includes(baseKey)) {
      if (baseKey === "ADR") {
        adrEntries[key] = value; // Keep ADR separate to place after BDAY
      } else {
        priorityEntries[key] = value;
      }
    } else {
      otherEntries[key] = value;
    }
  });

  // Sort priority entries based on priority order
  const sortedPriorityEntries = Object.fromEntries(
    Object.entries(priorityEntries).sort(([keyA], [keyB]) => {
      const baseKeyA = extractBaseKey(keyA);
      const baseKeyB = extractBaseKey(keyB);
      return priorityOrder.indexOf(baseKeyA) - priorityOrder.indexOf(baseKeyB);
    })
  );

  // Sort non-priority fields alphabetically while preserving indexes
  const sortedOtherEntries = Object.fromEntries(
    Object.entries(otherEntries).sort(([a], [b]) => a.localeCompare(b))
  );

  return { ...sortedPriorityEntries, ...adrEntries, ...sortedOtherEntries };
}
