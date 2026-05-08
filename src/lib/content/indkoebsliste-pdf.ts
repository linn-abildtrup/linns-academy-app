// PDF-eksport af indkøbsliste + opskrifter i Linn's Academy-design.
//
// Designet matcher ref-appens: cremebaggrund, terra-accenter, italic
// Playfair-look (times-italic er tæt erstatning), fact-bokse, sidefod
// med branding. Porteret fra reference/index.html.

import jsPDF from 'jspdf';
import type { Opskrift } from './opskrifter';
import {
	BUTIKS_GRUPPER,
	BUTIKS_LABELS,
	formaterMaengde,
	gaetGruppe,
	grupperIndkoebsliste,
	skaler,
	type IndkoebsItem,
	type ValgteOpskrifter
} from './indkoebsliste';

// Brand-farver matcher CSS-variabler
const FARVER = {
	bg: [250, 246, 241] as [number, number, number],
	border: [232, 222, 212] as [number, number, number],
	terra: [184, 123, 110] as [number, number, number],
	text: [53, 35, 24] as [number, number, number],
	text2: [107, 78, 66] as [number, number, number],
	text3: [160, 136, 120] as [number, number, number],
	factBox: [242, 235, 227] as [number, number, number],
	pillBg: [244, 232, 228] as [number, number, number]
};

// Strip emojis og symboler som standard PDF-fonte ikke kan rendere
export function rensTekst(s: string, opts?: { preserveNewlines?: boolean }): string {
	if (!s) return '';
	const preserveNewlines = opts?.preserveNewlines;
	let out = String(s)
		.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
		.replace(/[⌀-⏿]/g, '')
		.replace(/[☀-➿]/g, '')
		.replace(/[⬀-⯿]/g, '')
		.replace(/[←-⇿]/g, '')
		.replace(/[■-◿]/g, '')
		.replace(/[✀-➿]/g, '')
		.replace(/[︀-️]/g, '')
		.replace(/‍/g, '');
	if (preserveNewlines) {
		out = out.replace(/[ \t]+/g, ' ');
		out = out
			.split('\n')
			.map((l) => l.replace(/^[\s·,;]+/, '').trim())
			.join('\n');
	} else {
		out = out
			.replace(/^[\s·,;]+/, '')
			.replace(/\s+/g, ' ')
			.trim();
	}
	return out;
}

function pageBg(doc: jsPDF) {
	doc.setFillColor(...FARVER.bg);
	doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
}

function header(doc: jsPDF, modulNavn?: string) {
	doc.setFillColor(...FARVER.terra);
	doc.rect(0, 0, doc.internal.pageSize.getWidth(), 1.2, 'F');
	doc.setFont('times', 'italic');
	doc.setFontSize(11);
	doc.setTextColor(...FARVER.terra);
	doc.text("Linn's", 20, 14);
	doc.setFont('times', 'bold');
	doc.setTextColor(...FARVER.text);
	doc.text('ACADEMY', 32, 14);
	if (modulNavn) {
		const W = doc.internal.pageSize.getWidth();
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(7);
		doc.setTextColor(...FARVER.terra);
		doc.text(modulNavn.toUpperCase(), W - 20, 14, { align: 'right', charSpace: 0.6 });
	}
	doc.setDrawColor(...FARVER.border);
	doc.setLineWidth(0.2);
	doc.line(20, 18, doc.internal.pageSize.getWidth() - 20, 18);
}

function footer(doc: jsPDF, sideNum: number) {
	const W = doc.internal.pageSize.getWidth();
	const H = doc.internal.pageSize.getHeight();
	doc.setDrawColor(...FARVER.border);
	doc.setLineWidth(0.2);
	doc.line(20, H - 15, W - 20, H - 15);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(...FARVER.text3);
	doc.text("Linn's Academy  ·  linnsacademy.dk", 20, H - 10);
	doc.setTextColor(...FARVER.terra);
	doc.setFont('helvetica', 'bold');
	doc.text(String(sideNum), W - 20, H - 10, { align: 'right' });
}

function nySide(doc: jsPDF, modulNavn?: string): number {
	doc.addPage();
	pageBg(doc);
	header(doc, modulNavn);
	return 28;
}

function tjekSidebrud(doc: jsPDF, y: number, behov: number, modulNavn?: string): number {
	if (y + behov > 275) return nySide(doc, modulNavn);
	return y;
}

function sektion(doc: jsPDF, label: string, y: number): number {
	const W = doc.internal.pageSize.getWidth();
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8);
	doc.setTextColor(...FARVER.terra);
	doc.text(label.toUpperCase(), 20, y, { charSpace: 0.8 });
	const textW = doc.getTextWidth(label.toUpperCase()) + 4;
	doc.setDrawColor(...FARVER.border);
	doc.setLineWidth(0.2);
	doc.line(20 + textW + 2, y - 0.8, W - 20, y - 0.8);
	return y + 7;
}

function factBox(doc: jsPDF, tekst: string, y: number): number {
	if (!tekst) return y;
	const W = doc.internal.pageSize.getWidth();
	doc.setFont('helvetica', 'italic');
	doc.setFontSize(9);
	const lines = doc.splitTextToSize(tekst, 160);
	const h = 6 + lines.length * 4.2;
	if (y + h > 270) {
		doc.addPage();
		pageBg(doc);
		header(doc);
		y = 28;
	}
	doc.setFillColor(...FARVER.factBox);
	doc.rect(20, y, W - 40, h, 'F');
	doc.setFillColor(...FARVER.terra);
	doc.rect(20, y, 1.2, h, 'F');
	doc.setTextColor(...FARVER.text2);
	let ty = y + 5;
	for (const line of lines) {
		doc.text(line, 25, ty);
		ty += 4.2;
	}
	return y + h + 5;
}

function metaPiller(doc: jsPDF, items: string[], y: number): number {
	let x = 20;
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7.5);
	const maxX = 190;
	const maxPillW = maxX - 20;
	for (const it of items) {
		if (!it) continue;
		let txt = rensTekst(it).toUpperCase();
		if (!txt) continue;
		let w = doc.getTextWidth(txt) + txt.length * 0.4 + 8;
		while (w > maxPillW && txt.length > 4) {
			txt = txt.slice(0, -2);
			w = doc.getTextWidth(txt) + txt.length * 0.4 + 8;
		}
		if (x + w > maxX) {
			x = 20;
			y += 9;
		}
		doc.setFillColor(...FARVER.pillBg);
		doc.setDrawColor(...FARVER.terra);
		doc.setLineWidth(0.15);
		doc.roundedRect(x, y - 4, w, 6, 3, 3, 'FD');
		doc.setTextColor(...FARVER.terra);
		doc.text(txt, x + w / 2, y, { align: 'center', charSpace: 0.4 });
		x += w + 4;
	}
	return y + 6;
}

function shoppingItem(doc: jsPDF, item: IndkoebsItem, y: number): number {
	doc.setDrawColor(...FARVER.terra);
	doc.setLineWidth(0.3);
	doc.rect(20, y - 3, 3, 3);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9.5);
	doc.setTextColor(...FARVER.terra);
	const m = `${formaterMaengde(item.maengde)} ${rensTekst(item.enhed || '')}`.trim();
	doc.text(m, 26, y);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	doc.setTextColor(...FARVER.text);
	doc.text(rensTekst(item.navn), 56, y);
	doc.setDrawColor(...FARVER.border);
	doc.setLineWidth(0.1);
	doc.setLineDashPattern([0.5, 0.8], 0);
	doc.line(26, y + 1.5, 190, y + 1.5);
	doc.setLineDashPattern([], 0);
	return y + 6;
}

function recipeIngrediens(
	doc: jsPDF,
	item: { maengde: number; enhed: string; navn: string },
	y: number
): number {
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9.5);
	doc.setTextColor(...FARVER.terra);
	const m = `${formaterMaengde(item.maengde)} ${rensTekst(item.enhed || '')}`.trim();
	doc.text(m, 22, y);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	doc.setTextColor(...FARVER.text);
	doc.text(rensTekst(item.navn), 52, y);
	doc.setDrawColor(...FARVER.border);
	doc.setLineWidth(0.1);
	doc.setLineDashPattern([0.5, 0.8], 0);
	doc.line(22, y + 1.5, 190, y + 1.5);
	doc.setLineDashPattern([], 0);
	return y + 6;
}

function forside(doc: jsPDF, opskriftAntal: number) {
	const W = doc.internal.pageSize.getWidth();
	pageBg(doc);

	doc.setFillColor(...FARVER.terra);
	doc.rect(0, 0, W, 1.2, 'F');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7.5);
	const tag = '21 DAGE TIL EN SUND OVERGANGSALDER';
	const tagW = doc.getTextWidth(tag) + tag.length * 0.5 + 22;
	doc.setFillColor(...FARVER.terra);
	doc.roundedRect(W / 2 - tagW / 2, 70, tagW, 7.5, 3.75, 3.75, 'F');
	doc.setTextColor(250, 246, 241);
	doc.text(tag, W / 2, 75, { align: 'center', charSpace: 0.5 });

	doc.setFont('times', 'normal');
	doc.setFontSize(18);
	doc.setTextColor(...FARVER.terra);
	doc.text('·  ·  ·', W / 2, 92, { align: 'center' });

	doc.setFont('times', 'italic');
	doc.setFontSize(48);
	doc.setTextColor(...FARVER.terra);
	doc.text('Min', W / 2, 118, { align: 'center' });
	doc.setFont('times', 'normal');
	doc.setTextColor(...FARVER.text);
	doc.text('uge i køkkenet', W / 2, 138, { align: 'center' });

	doc.setFont('times', 'italic');
	doc.setFontSize(13);
	doc.setTextColor(...FARVER.text2);
	doc.text('Indkøbsliste og opskrifter, klar til print', W / 2, 152, { align: 'center' });

	doc.setFont('times', 'normal');
	doc.setFontSize(18);
	doc.setTextColor(...FARVER.terra);
	doc.text('·  ·  ·', W / 2, 168, { align: 'center' });

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	doc.setTextColor(...FARVER.text3);
	const sub =
		opskriftAntal === 1
			? `${opskriftAntal} valgt opskrift  ·  ${new Date().toLocaleDateString('da-DK')}`
			: `${opskriftAntal} valgte opskrifter  ·  ${new Date().toLocaleDateString('da-DK')}`;
	doc.text(sub, W / 2, 192, { align: 'center' });
}

/**
 * Hovedfunktion: generér PDF med forside + indkøbsliste + alle valgte opskrifter.
 * Triggerer automatisk download i browseren.
 */
export function genererPDF(
	indkoebsliste: IndkoebsItem[],
	opskrifter: Opskrift[],
	valgte: ValgteOpskrifter
): void {
	const doc = new jsPDF({ unit: 'mm', format: 'a4' });
	const aktive = indkoebsliste.filter((i) => !i.tjekket);
	const opskriftMap = new Map(opskrifter.map((o) => [o.id, o]));
	const opskriftAntal = valgte.size;

	// Forside
	forside(doc, opskriftAntal);

	// Indkøbsliste
	if (aktive.length) {
		let y = nySide(doc, 'Indkøbsliste');

		doc.setFont('times', 'italic');
		doc.setFontSize(34);
		doc.setTextColor(...FARVER.terra);
		doc.text('Indkøbs', 20, y + 10);
		doc.setFont('times', 'normal');
		doc.setTextColor(...FARVER.text);
		const indkW = doc.getTextWidth('Indkøbs');
		doc.text('liste', 20 + indkW + 1, y + 10);
		y += 16;

		doc.setFont('times', 'italic');
		doc.setFontSize(11);
		doc.setTextColor(...FARVER.text2);
		const sub =
			opskriftAntal === 1
				? `Samlet for 1 valgt opskrift`
				: `Samlet for ${opskriftAntal} valgte opskrifter`;
		doc.text(sub, 20, y);
		y += 12;

		// Berig items med korrekt gruppe
		const berig = aktive.map((i) => ({
			...i,
			gruppe: i.gruppe !== 'andet' ? i.gruppe : gaetGruppe(i.navn)
		}));
		const grupper = grupperIndkoebsliste(berig);

		for (const g of BUTIKS_GRUPPER) {
			if (!grupper[g].length) continue;
			y = tjekSidebrud(doc, y, 12 + grupper[g].length * 6, 'Indkøbsliste');
			doc.setFillColor(...FARVER.terra);
			doc.rect(20, y - 3, 5, 0.8, 'F');
			doc.setFont('times', 'bold');
			doc.setFontSize(13);
			doc.setTextColor(...FARVER.text);
			doc.text(BUTIKS_LABELS[g], 28, y);
			y += 7;
			for (const item of grupper[g]) {
				y = tjekSidebrud(doc, y, 6, 'Indkøbsliste');
				y = shoppingItem(doc, item, y);
			}
			y += 4;
		}

		if (y < 250) {
			y = factBox(
				doc,
				'Tip: Print listen ud og hæng den på køleskabet, eller fold den og tag den med i butikken. Krydser du af undervejs, glemmer du intet.',
				y
			);
		}
	}

	// Opskrifter
	for (const [opskriftId, valgtePortioner] of valgte.entries()) {
		const o = opskriftMap.get(opskriftId);
		if (!o) continue;

		const modulNavn = 'Opskrift';
		let y = nySide(doc, modulNavn);

		// Titel
		doc.setFont('times', 'normal');
		doc.setFontSize(28);
		doc.setTextColor(...FARVER.text);
		const titelLinjer = doc.splitTextToSize(rensTekst(o.titel), 170);
		for (const line of titelLinjer) {
			doc.text(line, 20, y + 2);
			y += 11;
		}
		y += 2;

		// Beskrivelse
		const beskrivelse = rensTekst(o.beskrivelse || '');
		if (beskrivelse) {
			doc.setFont('times', 'italic');
			doc.setFontSize(11);
			doc.setTextColor(...FARVER.text2);
			const linjer = doc.splitTextToSize(beskrivelse, 170);
			for (const line of linjer) {
				doc.text(line, 20, y);
				y += 5;
			}
			y += 3;
		}

		// Meta-piller
		const piller = [`${valgtePortioner} ${valgtePortioner === 1 ? 'person' : 'personer'}`];
		y = metaPiller(doc, piller, y);
		y += 4;

		// Ingredienser
		y = tjekSidebrud(doc, y, 14, modulNavn);
		y = sektion(doc, 'Ingredienser', y);
		for (const ing of o.ingredienser) {
			y = tjekSidebrud(doc, y, 6, modulNavn);
			const skaleret = skaler(ing.maengde, o.defaultPortioner, valgtePortioner);
			y = recipeIngrediens(doc, { maengde: skaleret, enhed: ing.enhed, navn: ing.navn }, y);
		}
		y += 5;

		// Fremgangsmåde
		const instr = rensTekst(o.instruktioner || '', { preserveNewlines: true });
		if (instr) {
			y = tjekSidebrud(doc, y, 14, modulNavn);
			y = sektion(doc, 'Fremgangsmåde', y);

			let trin: string[];
			if (instr.includes('\n')) {
				trin = instr.split(/\n+/).filter((s) => s.trim());
			} else {
				const nummereret = instr.split(/\s+(?=\d{1,2}[\.\)]\s)/);
				trin = nummereret.length > 1 ? nummereret.filter((s) => s.trim()) : [instr];
			}

			let trinNum = 1;
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(10);
			doc.setTextColor(...FARVER.text);

			for (const t of trin) {
				const ren = t.replace(/^\s*\d+[\.\)]\s*/, '').trim();
				if (!ren) continue;
				const linjer = doc.splitTextToSize(ren, 162);
				y = tjekSidebrud(doc, y, linjer.length * 4.5 + 3, modulNavn);
				doc.setFont('times', 'italic');
				doc.setFontSize(11);
				doc.setTextColor(...FARVER.terra);
				doc.text(String(trinNum), 22, y);
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(10);
				doc.setTextColor(...FARVER.text);
				let linjeY = y;
				for (const ln of linjer) {
					doc.text(ln, 28, linjeY);
					linjeY += 4.5;
				}
				y = linjeY + 2;
				trinNum++;
			}
		}
	}

	// Sidefod på alle sider undtagen forsiden
	const total = doc.internal.pages.length - 1; // jsPDF har en offset
	for (let i = 2; i <= total; i++) {
		doc.setPage(i);
		footer(doc, i);
	}

	const dato = new Date().toISOString().slice(0, 10);
	doc.save(`linns-academy-indkoebsliste-${dato}.pdf`);
}
