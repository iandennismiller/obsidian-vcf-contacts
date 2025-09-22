import { ensureHasName } from "src/contacts/vcard/shared/ensureHasName";

export async function createEmpty() {
  const vCardObject: Record<string, any> = {
    "N.PREFIX": "",
    "N.GN": "",
    "N.MN": "",
    "N.FN": "",
    "N.SUFFIX": "",
    "TEL[CELL]": "",
    "TEL[HOME]": "",
    "TEL[WORK]": "",
    "EMAIL[HOME]": "",
    "EMAIL[WORK]": "",
    "BDAY": "",
    "PHOTO": "",
    "ADR[HOME].STREET": "",
    "ADR[HOME].LOCALITY": "",
    "ADR[HOME].POSTAL": "",
    "ADR[HOME].COUNTRY": "",
    "URL[WORK]": "",
    "ORG": "",
    "ROLE": "",
    "CATEGORIES": "",
    "UID": `urn:uuid:${crypto.randomUUID()}`,
    "VERSION": "4.0"
  }
  return await ensureHasName(vCardObject);
}
