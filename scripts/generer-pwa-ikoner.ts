// Genererer PWA-ikoner og favicon til Linn's Academy.
// Symbolet er en kvadratisk version af brand-lockup'en: "Linn's" italic
// over et hairline ∞-tegn — Academy-laget skrottes for ikonet (kan ikke
// læses i 32px). Cream baggrund, terra accent.
//
// Kør: npx tsx scripts/generer-pwa-ikoner.ts

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';

const STATIC_DIR = join(import.meta.dirname, '..', 'static');
const FONT_DIR = join(import.meta.dirname, 'fonts');

const TERRA = '#B87B6E';
const TEXT = '#352318';
const CREME = '#FAF6F1';

// Konvertér "Linn's" til en SVG-path via opentype.js. Vi kan ikke bruge
// <text font-family="Playfair Display" font-style="italic"> i SVG'en,
// fordi librsvg/Pango på macOS ikke kobler font-style:italic til en
// separat italic-fil — så font-rendering falder tilbage til en regular
// sans-serif. Path-konvertering fjerner font-afhængigheden helt.
const playfair = opentype.parse(
	readFileSync(join(FONT_DIR, 'PlayfairDisplay-Italic.ttf')).buffer
);

function linnsPath(centerX: number, baselineY: number, fontSize: number): string {
	// Bygger pathen glyph-for-glyph i stedet for at kalde getPath på hele
	// strengen. Det omgår en bug i opentype.js hvor moderne OpenType-
	// features (lookupType 6 substFormat 2 i Playfair v40) crasher
	// stringToGlyphs. Glyph-by-glyph bruger ikke text-shaping, så vi
	// undgår fejlen helt.
	const text = "Linn's";
	const scale = fontSize / playfair.unitsPerEm;
	let advance = 0;
	const glyphs: { glyph: opentype.Glyph; x: number }[] = [];
	for (const ch of text) {
		const glyph = playfair.charToGlyph(ch);
		glyphs.push({ glyph, x: advance });
		advance += (glyph.advanceWidth ?? 0) * scale;
	}
	const startX = centerX - advance / 2;
	const parts: string[] = [];
	for (const { glyph, x } of glyphs) {
		const p = glyph.getPath(startX + x, baselineY, fontSize);
		parts.push(p.toPathData(2));
	}
	return parts.join(' ');
}

/**
 * Bygger SVG-symbolet til PWA-ikonet i en given størrelse.
 *
 * @param size Pixel-størrelsen (kvadrat, viewBox 0..size)
 * @param maskerable Hvis true tegnes med mere padding (Android adaptive icons
 *                   kropper op til 20%, så vi tegner indenfor en safe-zone)
 */
function symbol(size: number, maskerable = false): string {
	// Padding så hovedindholdet ligger indenfor safe-zone (især vigtigt for
	// maskerable variant). Brugeren ser ikke nødvendigvis de yderste pixels.
	const padPct = maskerable ? 0.2 : 0.12;
	const safe = size * (1 - 2 * padPct);
	const safeX = size * padPct;
	const safeY = size * padPct;

	// "Linn's" — fontstørrelse skaleres til ca. 38% af safe-zone
	const linnsFontSize = Math.round(safe * 0.38);
	const linnsY = safeY + safe * 0.4;

	// ∞-tegnet — original viewBox er 540x140, skala det så bredden bliver
	// ca. 76% af safe-zone og det centreres under "Linn's"
	const infWidth = safe * 0.76;
	const infHeight = (infWidth * 140) / 540;
	const infX = safeX + (safe - infWidth) / 2;
	const infY = safeY + safe * 0.55;
	// Stroke skaleres med størrelsen så hairline forbliver synligt
	const stroke = Math.max(1.4, size * 0.005);

	const linnsD = linnsPath(size / 2, linnsY, linnsFontSize);

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CREME}"/>
  <path d="${linnsD}" fill="${TEXT}"/>
  <g transform="translate(${infX}, ${infY}) scale(${infWidth / 540})">
    <path d="M 110 70 C 110 30, 200 30, 270 70 C 340 110, 430 110, 430 70 C 430 30, 340 30, 270 70 C 200 110, 110 110, 110 70 Z"
          fill="none"
          stroke="${TERRA}"
          stroke-width="${(stroke * 540) / infWidth}"
          stroke-linejoin="round"
          stroke-linecap="round"/>
  </g>
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
		const buf = Buffer.from(symbol(s.size));
		const png = await sharp(buf).png().toBuffer();
		const sti = join(STATIC_DIR, s.navn);
		writeFileSync(sti, png);
		console.log('  ✓', s.navn, `(${s.size}×${s.size})`);
	}

	// Maskerable variant til Android adaptive icons (skal kunne croppes 20%)
	const maskBuf = Buffer.from(symbol(512, true));
	const maskPng = await sharp(maskBuf).png().toBuffer();
	writeFileSync(join(STATIC_DIR, 'icon-512-maskable.png'), maskPng);
	console.log('  ✓ icon-512-maskable.png (512×512, maskerable)');

	// Favicon (vector, lille)
	writeFileSync(join(STATIC_DIR, 'icon.svg'), symbol(512));
	console.log('  ✓ icon.svg (vector, 512×512)');
	console.log('Færdig.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
