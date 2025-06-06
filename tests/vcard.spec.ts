import { App } from "obsidian";
import { createEmpty } from 'src/contacts/vcard/createEmpty';
import { setApp } from "src/context/sharedAppContext";
import { describe, expect, it, vi } from 'vitest';

setApp({} as App);

vi.mock('src/ui/modals/contactNameModal', () => {
  class ContactNameModal {
    private callback: (givenName: string, familyName: string) => void;

    constructor(
      app: any,
      vcfFn: string | undefined,
      callback: (givenName: string, familyName: string) => void
    ) {
      this.callback = callback;
    }
    open() {
      this.callback('Foo', 'Bar');
    }
    onOpen() {}
    onClose() {}
    close() {}
  }

  return { ContactNameModal };
});
describe('vcard creatEmpty', () => {
  it('should ask for a firstname and lastname ', async () => {
    const empty = await createEmpty();
    expect(empty).toBeDefined();

    expect(empty).toEqual(expect.objectContaining({
      'N.PREFIX': '',
      'N.GN': 'Foo',
      'N.MN': '',
      'N.FN': 'Bar',
      'N.SUFFIX': ''
    }));

    const keys = Object.keys(empty);
    const expectedNFields = ['N.PREFIX', 'N.GN', 'N.MN', 'N.FN', 'N.SUFFIX'];
    expect(keys.slice(0, expectedNFields.length)).toEqual(expectedNFields);

  });
});
