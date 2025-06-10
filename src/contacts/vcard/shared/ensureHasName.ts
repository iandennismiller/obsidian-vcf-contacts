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
        if (vCardObject['N.PREFIX'] === undefined) {
          vCardObject['N.PREFIX'] = '';
        }
        vCardObject['N.GN'] = givenName;
        if (vCardObject['N.MN'] === undefined) {
          vCardObject['N.MN'] = '';
        }
        vCardObject['N.FN'] = familyName;
        if (vCardObject['N.SUFFIX'] === undefined) {
          vCardObject['N.SUFFIX'] = '';
        }
        resolve(vCardObject);
      }).open();
    }
  });
}
