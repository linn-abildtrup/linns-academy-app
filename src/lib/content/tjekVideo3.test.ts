import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { mp4Pakning, medieFejlTekst } from './tjekVideo3';

/** Laeser starten af en rigtig oevelsesvideo, hvis den ligger i repoet. */
function hoved(fil: string): ArrayBuffer | null {
	const sti = `videos-to-upload/${fil}`;
	if (!existsSync(sti)) return null;
	const b = readFileSync(sti).subarray(0, 8192);
	return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

describe('mp4Pakning', () => {
	it('kender en fil hvor indholdsfortegnelsen ligger forrest', () => {
		const b = hoved('bird_dog.mp4');
		if (!b) return;
		expect(mp4Pakning(b)).toBe('forrest');
	});

	it('kender en fil hvor den ligger bagerst', () => {
		const b = hoved('bent_over_row.mp4');
		if (!b) return;
		expect(mp4Pakning(b)).toBe('bagerst');
	});

	it('siger ukendt i stedet for at gaette paa noget der ikke er en mp4', () => {
		const tom = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
		expect(mp4Pakning(tom)).toBe('ukendt');
	});
});

describe('medieFejlTekst', () => {
	it('oversaetter telefonens tal til noget man kan laese', () => {
		expect(medieFejlTekst(3)).toContain('afkode');
		expect(medieFejlTekst(undefined)).toBe('');
		expect(medieFejlTekst(9)).toContain('9');
	});
});
