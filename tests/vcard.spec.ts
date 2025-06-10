import { App } from "obsidian";
import { vcard } from "src/contacts/vcard";
import { setApp } from "src/context/sharedAppContext";
import { fixtures } from "tests/fixtures/fixtures";
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
    const empty = await vcard.createEmpty();
    const expectedFields = ['N.PREFIX', 'N.GN', 'N.MN', 'N.FN', 'N.SUFFIX'];
    expectedFields.forEach((field) => {
      expect(empty).toHaveProperty(field);
    });
    expect(empty['N.GN']).toBe('Foo');
    expect(empty['N.FN']).toBe('Bar');
  });
});

describe('vcard parse', () => {

  it('Should ensure all the name variables exist and first name and lastname are filled', async () => {
    const vcf = fixtures.readVcfFixture('noFirstName.vcf');
    const result = await vcard.parse(vcf);
    const expectedFields = ['N.PREFIX', 'N.GN', 'N.MN', 'N.FN', 'N.SUFFIX'];
    expectedFields.forEach((field) => {
      expect(result[0]).toHaveProperty(field);
    });
    expect(result[0]['N.GN']).toBe('Foo');
    expect(result[0]['N.FN']).toBe('Bar');
  });

  it('should only import variables that are in a predifined list ', async () => {

  });

  it('should convert v3 internal phoro to a v4 version', async () => {

  });

  it('should be able to parse multiple cards from one file', async () => {

  });

  it('should add indexes to duplicate field names.', async () => {

  });

  it('should preform dome sorting and try to unify dates. ', async () => {

  });

});

