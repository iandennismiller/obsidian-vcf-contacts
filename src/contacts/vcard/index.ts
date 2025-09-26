export * from 'src/contacts/vcard/shared/vcard.d';
import { createEmpty } from 'src/contacts/vcard/createEmpty';
import { parse } from 'src/contacts/vcard/parse';
import { toString } from 'src/contacts/vcard/toString';
export { VCardFileOps } from 'src/contacts/vcard/fileOps';

export const vcard = {
  parse,
  toString,
  createEmpty,
};
