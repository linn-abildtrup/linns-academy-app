// Engangs-tjek: hvilke filer i exercises/ har indholdsfortegnelsen bagerst.
//
// En MP4 har en indholdsfortegnelse, kaldet moov, og selve billeddataen,
// kaldet mdat. Ligger moov BAGERST skal telefonen hente hele filen hjem foer
// den kan begynde at vise noget. Ligger den forrest, saakaldt faststart,
// starter videoen naesten med det samme.
//
// Scriptet laeser kun. Det henter de foerste faa kilobyte af hver fil og
// gaar kasserne igennem forfra, indtil den moeder enten moov eller mdat.
//
// Rettes en fil, sker det med:  ffmpeg -i gammel.mp4 -c copy -movflags +faststart ny.mp4
// og filen laegges op igen MED det gamle token bevaret, ellers holder de
// adresser kunderne allerede har faaet op med at virke.
//
// Koeres manuelt:  npx tsx scripts/_tjek-video-pakning.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({
	credential: cert(sa),
	storageBucket: 'linns-academy-app.firebasestorage.app'
});
const bucket = getStorage().bucket();

/**
 * Gaar MP4-kasserne igennem forfra og siger hvad der kommer foerst, moov
 * eller mdat. Hver kasse starter med fire bytes stoerrelse og fire bytes
 * navn. Stoerrelse 1 betyder at den rigtige stoerrelse staar i de naeste
 * otte bytes, og stoerrelse 0 betyder resten af filen.
 */
function foersteKasse(buf: Buffer): 'moov' | 'mdat' | 'ukendt' {
	let pos = 0;
	while (pos + 8 <= buf.length) {
		let stoerrelse = buf.readUInt32BE(pos);
		const navn = buf.toString('latin1', pos + 4, pos + 8);
		let hoved = 8;
		if (stoerrelse === 1) {
			if (pos + 16 > buf.length) return 'ukendt';
			// 64-bit stoerrelse. Vores filer er langt under 4 GB, saa de
			// oeverste fire bytes er nul og kan springes over.
			stoerrelse = buf.readUInt32BE(pos + 12);
			hoved = 16;
		}
		if (navn === 'moov') return 'moov';
		if (navn === 'mdat') return 'mdat';
		if (stoerrelse === 0 || stoerrelse < hoved) return 'ukendt';
		pos += stoerrelse;
	}
	return 'ukendt';
}

(async () => {
	const [filer] = await bucket.getFiles({ prefix: 'exercises/' });
	const mp4 = filer.filter((f) => f.name.toLowerCase().endsWith('.mp4'));
	console.log(`Tjekker ${mp4.length} videoer i exercises/\n`);

	const bagerst: string[] = [];
	const forrest: string[] = [];
	const uklare: string[] = [];

	for (const f of mp4) {
		// 256 kB er rigeligt til at naa den foerste rigtige kasse, og det er
		// smaat nok til at hele runden koster meget lidt.
		let buf: Buffer;
		try {
			[buf] = await f.download({ start: 0, end: 262143 });
		} catch (e) {
			console.warn(`  kunne ikke hentes: ${f.name}`, e);
			uklare.push(f.name);
			continue;
		}
		const svar = foersteKasse(buf);
		if (svar === 'moov') forrest.push(f.name);
		else if (svar === 'mdat') bagerst.push(f.name);
		else uklare.push(f.name);
	}

	console.log(`=== Indholdsfortegnelsen BAGERST (${bagerst.length}) — bør pakkes om ===`);
	for (const n of bagerst) console.log(`  ${n}`);
	console.log(`\n=== Indholdsfortegnelsen forrest, i orden (${forrest.length}) ===`);
	for (const n of forrest) console.log(`  ${n}`);
	if (uklare.length) {
		console.log(`\n=== Kunne ikke afgøres (${uklare.length}) ===`);
		for (const n of uklare) console.log(`  ${n}`);
	}
	process.exit(0);
})();
