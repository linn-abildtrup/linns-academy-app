import { describe, it, expect } from 'vitest';
import { maaHentes3, dokumentUrl3 } from './dokument3';

const SIMPLERO = 'https://us.simplerousercontent.net/uploads/asset/file/15162254/morgenmad.pdf';

describe('maaHentes3', () => {
	it('lukker Linns egne dokumenter ind', () => {
		expect(maaHentes3(SIMPLERO).ok).toBe(true);
		expect(maaHentes3('https://firebasestorage.googleapis.com/v0/b/x/o/plan.pdf').ok).toBe(true);
	});

	// DEN VIGTIGSTE. Uden det foerste punktum i tjekket ville en vaert der
	// bare SLUTTER paa det tilladte navn slippe igennem, og saa har vi en
	// aaben doer.
	it('afviser en vaert der bare ligner', () => {
		expect(maaHentes3('https://ondsindetsimplerousercontent.net/fil.pdf').ok).toBe(false);
		expect(maaHentes3('https://simplerousercontent.net.angriber.dk/fil.pdf').ok).toBe(false);
	});

	it('afviser alt andet paa nettet', () => {
		expect(maaHentes3('https://example.com/fil.pdf').ok).toBe(false);
	});

	it('kraever https', () => {
		expect(maaHentes3(SIMPLERO.replace('https:', 'http:')).ok).toBe(false);
	});

	it('afviser andet end pdf', () => {
		expect(maaHentes3('https://us.simplerousercontent.net/fil.exe').ok).toBe(false);
		expect(maaHentes3('https://us.simplerousercontent.net/fil.html').ok).toBe(false);
	});

	// En adresse kan have noget efter spoergsmaalstegnet, fx en noegle.
	it('ser paa stien og ikke paa det der staar efter spoergsmaalstegnet', () => {
		expect(maaHentes3(SIMPLERO + '?token=abc').ok).toBe(true);
		// Og man kan ikke snyde ved at skrive .pdf i noeglen
		expect(maaHentes3('https://us.simplerousercontent.net/fil.exe?x=.pdf').ok).toBe(false);
	});

	it('taaler noget der slet ikke er en adresse', () => {
		expect(maaHentes3('').ok).toBe(false);
		expect(maaHentes3('bare noget tekst').ok).toBe(false);
	});
});

describe('dokumentUrl3', () => {
	it('pakker adressen ind, saa tegn ikke gaar i stykker', () => {
		const ud = dokumentUrl3('https://us.simplerousercontent.net/en fil&x.pdf');
		expect(ud.startsWith('/api/ny-dokument?url=')).toBe(true);
		expect(ud).not.toContain(' ');
		expect(ud).not.toContain('&x.pdf');
	});
});

describe('dokumentUrl3 · hvor filen ligger', () => {
	it('bruger vores egne filer direkte, uden en omvej', () => {
		const egen = 'https://firebasestorage.googleapis.com/v0/b/x/o/plan.pdf?alt=media';
		expect(dokumentUrl3(egen)).toBe(egen);
	});

	it('sender kun udefra-filer gennem serveren', () => {
		expect(dokumentUrl3(SIMPLERO).startsWith('/api/ny-dokument')).toBe(true);
	});
});
