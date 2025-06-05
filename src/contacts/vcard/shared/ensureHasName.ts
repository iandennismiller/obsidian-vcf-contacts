import { VCardForObsidianRecord } from "src/contacts/vcard/index";
import { getApp } from "src/context/sharedAppContext";
import { ContactNameModal } from "src/ui/modals/contactNameModal";

export async function ensureHasName(vCardObject: VCardForObsidianRecord): Promise<VCardForObsidianRecord> {
  const app = getApp();
  return new Promise((resolve) => {
    if (vCardObject['N.GN'] && vCardObject['N.FN']) {
      resolve(vCardObject);
    } else {
      new ContactNameModal(app, vCardObject['FN'], (givenName, familyName) => {
        vCardObject['N.GN'] = givenName;
        vCardObject['N.FN'] = familyName;
        resolve(vCardObject);
      }).open();
    }
  });
}
