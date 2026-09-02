// ============================================================
// Regnestykkerne bag Tjek video. Rent modul, saa de kan proeves af.
//
// Bygget 2. september 2026, da en iPhone 12 Pro Max viste sort skaerm
// mens en anden iPhone var fin i samme oejeblik.
// ============================================================

/**
 * Ligger indholdsfortegnelsen forrest i mp4-filen.
 *
 * Ligger den bagerst, skal telefonen hente HELE filen foer den kan vise
 * det foerste billede. Det er sort skaerm og hak i starten, og det er
 * noget der blev afgjort da filen blev pakket, ikke noget kunden goer.
 *
 * En mp4-fil er kasser efter hinanden: fire byte med stoerrelsen, fire
 * med navnet. Vi gaar dem igennem indtil vi moeder enten moov, som er
 * indholdsfortegnelsen, eller mdat, som er selve billederne.
 */
export function mp4Pakning(buf: ArrayBuffer): 'forrest' | 'bagerst' | 'ukendt' {
	const d = new DataView(buf);
	let pos = 0;
	let kasser = 0;
	while (pos + 8 <= d.byteLength && kasser < 8) {
		const stoerrelse = d.getUint32(pos);
		const navn = String.fromCharCode(
			d.getUint8(pos + 4),
			d.getUint8(pos + 5),
			d.getUint8(pos + 6),
			d.getUint8(pos + 7)
		);
		if (navn === 'moov') return 'forrest';
		if (navn === 'mdat') return 'bagerst';
		// En kasse paa 0 betyder "resten af filen", og en paa 1 betyder at
		// stoerrelsen staar et andet sted. Begge dele giver os ikke noget at
		// gaa videre paa her.
		if (stoerrelse <= 1 || pos + stoerrelse > d.byteLength) return 'ukendt';
		pos += stoerrelse;
		kasser += 1;
	}
	return 'ukendt';
}

/** Det telefonen mener, naar den siger nej med et tal. */
export function medieFejlTekst(kode: number | undefined): string {
	if (!kode) return '';
	const tekster: Record<number, string> = {
		1: 'afbrudt undervejs',
		2: 'netværket svigtede midt i hentningen',
		3: 'telefonen kunne ikke afkode filen',
		4: 'filtypen kan ikke afspilles her'
	};
	return tekster[kode] ?? `ukendt fejl (${kode})`;
}
