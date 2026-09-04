import { describe, expect, it } from 'vitest';
import { mp4Pakning, medieFejlTekst } from './tjekVideo3';

// ============================================================
// TESTEN LAESTE FOER RIGTIGE VIDEOFILER fra videos-to-upload, og den
// forventede at bent_over_row.mp4 var pakket forkert. Det var den ogsaa,
// da testen blev skrevet 2. september. Filen blev pakket om 3. september
// klokken 21.42, og saa begyndte testen at fejle.
//
// Den fejlede altsaa fordi PROBLEMET VAR LOEST. En test der gaar i
// stykker naar man retter noget, er en test der straffer det rigtige, og
// den ville fejle igen hver gang Linn pakker en video om.
//
// Nu bygges filens foerste kasser i stedet, saa vi proever selve reglen:
// kan den kende forrest fra bagerst. Den kan ikke blive forældet af at
// videoerne bliver bedre.
//
// SAADAN ER EN MP4 BYGGET: kasser efter hinanden. Fire byte med
// stoerrelsen, fire med navnet, og saa indholdet. 'moov' er
// indholdsfortegnelsen, 'mdat' er selve billederne.
// ============================================================

/** Bygger én kasse: stoerrelse, navn, og resten som nuller. */
function kasse(navn: string, stoerrelse: number): number[] {
	const ud = [
		(stoerrelse >>> 24) & 0xff,
		(stoerrelse >>> 16) & 0xff,
		(stoerrelse >>> 8) & 0xff,
		stoerrelse & 0xff,
		...[...navn].map((c) => c.charCodeAt(0))
	];
	while (ud.length < stoerrelse) ud.push(0);
	return ud;
}

/** Starten af en mp4-fil med kasserne i den raekkefoelge man beder om. */
function mp4(...navne: string[]): ArrayBuffer {
	const byte = navne.flatMap((n) => kasse(n, 16));
	return new Uint8Array(byte).buffer;
}

describe('mp4Pakning', () => {
	// Den gode: telefonen kan vise foerste billede med det samme.
	it('kender en fil hvor indholdsfortegnelsen ligger forrest', () => {
		expect(mp4Pakning(mp4('ftyp', 'moov', 'mdat'))).toBe('forrest');
	});

	// Den daarlige: telefonen skal hente HELE filen foer der sker noget.
	// Det var den her der gav sort skaerm paa en iPhone 12 Pro Max.
	it('kender en fil hvor den ligger bagerst', () => {
		expect(mp4Pakning(mp4('ftyp', 'mdat', 'moov'))).toBe('bagerst');
	});

	it('finder den ogsaa naar der staar flere kasser foran', () => {
		expect(mp4Pakning(mp4('ftyp', 'free', 'wide', 'moov'))).toBe('forrest');
	});

	it('siger ukendt i stedet for at gaette paa noget der ikke er en mp4', () => {
		const tom = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
		expect(mp4Pakning(tom)).toBe('ukendt');
	});

	it('siger ukendt naar filen slutter midt i en kasse', () => {
		// Stoerrelsen lover 999 byte, men der er kun 8.
		const halv = new Uint8Array([0, 0, 3, 231, 102, 116, 121, 112]).buffer;
		expect(mp4Pakning(halv)).toBe('ukendt');
	});

	// En kasse paa 0 betyder "resten af filen" og paa 1 at stoerrelsen
	// staar et andet sted. Ingen af delene kan vi gaa videre paa, og vi maa
	// ikke gaa i ring paa et nul.
	it('gaar ikke i ring paa en kasse uden stoerrelse', () => {
		const nul = new Uint8Array([0, 0, 0, 0, 102, 116, 121, 112]).buffer;
		expect(mp4Pakning(nul)).toBe('ukendt');
	});

	it('giver op i stedet for at lede i det uendelige', () => {
		// Ni ligegyldige kasser. Reglen kigger paa hoejst otte.
		expect(
			mp4Pakning(mp4('free', 'free', 'free', 'free', 'free', 'free', 'free', 'free', 'moov'))
		).toBe('ukendt');
	});

	it('taaler en helt tom fil', () => {
		expect(mp4Pakning(new ArrayBuffer(0))).toBe('ukendt');
	});
});

describe('medieFejlTekst', () => {
	it('oversaetter telefonens tal til noget man kan laese', () => {
		expect(medieFejlTekst(3)).toContain('afkode');
		expect(medieFejlTekst(undefined)).toBe('');
		expect(medieFejlTekst(9)).toContain('9');
	});
});
