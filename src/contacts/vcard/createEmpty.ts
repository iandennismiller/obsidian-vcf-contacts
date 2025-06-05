import { ensureHasName } from "src/contacts/vcard/shared/ensureHasName";
import { sortVCardOFields } from "src/contacts/vcard/shared/sortVcardFields";

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
    "CATEGORIES": "",
    "VERSION": "4.0"
  }
  const checkedNameVCardObject = await ensureHasName(vCardObject);
  return sortVCardOFields(checkedNameVCardObject);
}
