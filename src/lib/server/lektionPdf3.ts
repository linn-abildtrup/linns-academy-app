// ============================================================
// Lektionen som pdf, i Linns eget design.
//
// HVORFOR DEN IKKE LIGNER SIDEN. En skreven lektion ligger som en
// almindelig html-fil, og at gengive den praecis som den ser ud ville
// kraeve en hel browser paa serveren. I stedet tager vi indholdet og
// saetter det op paa Linns maade: creme, terra, kursiv overskrift og en
// sidefod med hendes navn. Den ligner hende, ikke en browserudskrift.
//
// Farverne er de samme som indkoebslistens pdf, saa de to filer ligner
// hinanden i hendes indbakke. Se content/indkoebsliste-pdf.ts, som
// bliver staaende uroert.
//
// DEN LAVES PAA SERVEREN, fordi teksten allerede er der: siden ligger
// paa et andet domaene, og en browser maa ikke laese den. Serveren maa.
//
// Bygget 5. september 2026.
// ============================================================

import jsPDF from 'jspdf';
import type { Blok } from '$lib/content/lektionHtml3';

const FARVER = {
	bg: [250, 246, 241] as [number, number, number],
	border: [232, 222, 212] as [number, number, number],
	terra: [184, 123, 110] as [number, number, number],
	text: [53, 35, 24] as [number, number, number],
	text2: [107, 78, 66] as [number, number, number],
	text3: [160, 136, 120] as [number, number, number],
	fakta: [242, 235, 227] as [number, number, number]
};

const MARGIN = 20;
const BUND = 22;

/**
 * De tegn de indbyggede skrifter ikke kan tegne.
 *
 * Uden det her bliver en emoji til et sort firkant midt i en saetning.
 * Aa, ae og oe kan de godt, saa dem roerer vi ikke.
 */
function rensTegn(s: string): string {
	return s
		.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
		.replace(/[←-⇿⌀-⏿☀-➿︀-️⬀-⯿]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function sidehoved(doc: jsPDF) {
	const B = doc.internal.pageSize.getWidth();
	doc.setFillColor(...FARVER.bg);
	doc.rect(0, 0, B, doc.internal.pageSize.getHeight(), 'F');
	doc.setFillColor(...FARVER.terra);
	doc.rect(0, 0, B, 1.2, 'F');
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8);
	doc.setTextColor(...FARVER.terra);
	doc.text('LINNS ACADEMY', MARGIN, 14, { charSpace: 1.2 });
}

function sidefod(doc: jsPDF, side: number) {
	const B = doc.internal.pageSize.getWidth();
	const H = doc.internal.pageSize.getHeight();
	doc.setDrawColor(...FARVER.border);
	doc.setLineWidth(0.2);
	doc.line(MARGIN, H - 15, B - MARGIN, H - 15);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(...FARVER.text3);
	doc.text('linnsacademy.dk', MARGIN, H - 10);
	doc.text(String(side), B - MARGIN, H - 10, { align: 'right' });
}

export interface PdfLektion3 {
	titel: string;
	/** Staar under titlen. Fx "Tirsdag den 14. april". */
	dato: string;
	blokke: Blok[];
}

/**
 * Bygger filen og giver den tilbage som raa bytes.
 *
 * Kalderen laver den om til det mailen skal bruge. Saa er den her
 * funktion fri for at vide noget om mail.
 */
export function byggLektionPdf3(l: PdfLektion3): Uint8Array {
	const doc = new jsPDF({ unit: 'mm', format: 'a4' });
	const B = doc.internal.pageSize.getWidth();
	const H = doc.internal.pageSize.getHeight();
	const bredde = B - MARGIN * 2;
	let side = 1;
	let y = 0;

	sidehoved(doc);

	// Titlen i kursiv, som paa forsiden af appen og i mockup'en.
	doc.setFont('times', 'italic');
	doc.setFontSize(22);
	doc.setTextColor(...FARVER.text);
	const titelLinjer = doc.splitTextToSize(rensTegn(l.titel) || 'Lektion', bredde) as string[];
	y = 30;
	for (const linje of titelLinjer) {
		doc.text(linje, MARGIN, y);
		y += 9;
	}

	if (l.dato) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		doc.setTextColor(...FARVER.text3);
		doc.text(rensTegn(l.dato), MARGIN, y);
		y += 6;
	}

	doc.setDrawColor(...FARVER.border);
	doc.setLineWidth(0.2);
	doc.line(MARGIN, y, B - MARGIN, y);
	y += 9;

	/** Ny side naar der ikke er plads til det naeste. */
	function plads(hoejde: number) {
		if (y + hoejde <= H - BUND) return;
		sidefod(doc, side);
		doc.addPage();
		side += 1;
		sidehoved(doc);
		y = 30;
	}

	for (const blok of l.blokke) {
		const tekst = rensTegn(blok.tekst);
		if (!tekst) continue;

		if (blok.slags === 'overskrift' || blok.slags === 'underoverskrift') {
			const stor = blok.slags === 'overskrift';
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(stor ? 13 : 11);
			doc.setTextColor(...FARVER.text);
			const linjer = doc.splitTextToSize(tekst, bredde) as string[];
			plads(linjer.length * 6 + 6);
			y += 3;
			for (const linje of linjer) {
				doc.text(linje, MARGIN, y);
				y += 6;
			}
			y += 2;
			continue;
		}

		if (blok.slags === 'citat') {
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(10);
			const linjer = doc.splitTextToSize(tekst, bredde - 10) as string[];
			const hoejde = linjer.length * 5.4 + 8;
			plads(hoejde + 4);
			doc.setFillColor(...FARVER.fakta);
			doc.rect(MARGIN, y - 4, bredde, hoejde, 'F');
			doc.setFillColor(...FARVER.terra);
			doc.rect(MARGIN, y - 4, 1.2, hoejde, 'F');
			doc.setTextColor(...FARVER.text2);
			let yy = y + 2;
			for (const linje of linjer) {
				doc.text(linje, MARGIN + 6, yy);
				yy += 5.4;
			}
			y += hoejde + 4;
			continue;
		}

		if (blok.slags === 'punkt') {
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(10.5);
			doc.setTextColor(...FARVER.text2);
			const linjer = doc.splitTextToSize(tekst, bredde - 6) as string[];
			plads(linjer.length * 5.6 + 2);
			doc.setTextColor(...FARVER.terra);
			doc.text('·', MARGIN, y);
			doc.setTextColor(...FARVER.text2);
			for (const linje of linjer) {
				doc.text(linje, MARGIN + 5, y);
				y += 5.6;
			}
			y += 1;
			continue;
		}

		doc.setFont('helvetica', 'normal');
		doc.setFontSize(10.5);
		doc.setTextColor(...FARVER.text2);
		const linjer = doc.splitTextToSize(tekst, bredde) as string[];
		plads(linjer.length * 5.6 + 4);
		for (const linje of linjer) {
			doc.text(linje, MARGIN, y);
			y += 5.6;
		}
		y += 3.5;
	}

	sidefod(doc, side);
	return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}

/**
 * Bytes om til base64, som er den form en vedhaeftning sendes i.
 *
 * Den tager en bid ad gangen. Kalder man String.fromCharCode med en hel
 * fil paa én gang, vaelter den paa store filer.
 */
export function tilBase64(bytes: Uint8Array): string {
	let s = '';
	const BID = 0x8000;
	for (let i = 0; i < bytes.length; i += BID) {
		s += String.fromCharCode(...bytes.subarray(i, i + BID));
	}
	return btoa(s);
}
