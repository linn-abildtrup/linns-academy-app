// Genererer PWA-ikoner fra et SVG-template med Linn's Academy LA-cirkel.
// Kører én gang hvis vi vil opdatere ikonerne — placeholder indtil et
// rigtigt logo er klar.
//
// Kør: npx tsx scripts/generer-pwa-ikoner.ts

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATIC_DIR = join(import.meta.dirname, '..', 'static');

const TERRA = '#B87B6E';
const CREME = '#FAF6F1';

function svg(size: number): string {
	const r = size / 2;
	const fontSize = Math.round(size * 0.36);
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${r}" cy="${r}" r="${r}" fill="${TERRA}"/>
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="Georgia, 'Playfair Display', serif"
    font-size="${fontSize}"
    font-weight="700"
    letter-spacing="${size * 0.015}"
    fill="${CREME}">LA</text>
</svg>`;
}

const stoerrelser = [
	{ navn: 'apple-touch-icon.png', size: 180 },
	{ navn: 'icon-192.png', size: 192 },
	{ navn: 'icon-512.png', size: 512 },
	{ navn: 'icon-1024.png', size: 1024 }
];

async function main() {
	console.log('Genererer PWA-ikoner i', STATIC_DIR);
	for (const s of stoerrelser) {
		const buf = Buffer.from(svg(s.size));
		const png = await sharp(buf).png().toBuffer();
		const sti = join(STATIC_DIR, s.navn);
		writeFileSync(sti, png);
		console.log('  ✓', s.navn, `(${s.size}×${s.size})`);
	}
	// Skriv også SVG'en som fallback
	writeFileSync(join(STATIC_DIR, 'icon.svg'), svg(512));
	console.log('  ✓ icon.svg (vector, 512×512)');
	console.log('Færdig.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
