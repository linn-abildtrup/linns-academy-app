// Billedbehandling i browseren til 3.0.
//
// Egen fil, fordi `billede.ts` hoerer til den gamle app og ikke maa aendres.
// Den kan kun jpeg og fortaeller ikke hvilke maal der kom ud, og begge dele
// skal vi bruge her.
//
// Alt sker i browseren FOER noget sendes. En 2,4 MB telefonbillede bliver til
// cirka 55 KB fordelt paa to stoerrelser, saa Storage aldrig ser den store fil.

import {
	STOERRELSER,
	endelseFor,
	formatDuger,
	nyeMaal,
	type Billedstoerrelse
} from '$lib/content/opskriftBillede3';

export interface Skaleret {
	blob: Blob;
	bredde: number;
	hoejde: number;
	mime: string;
	endelse: string;
}

export interface BilledeSaet {
	lille: Skaleret;
	stor: Skaleret;
	/** Den oprindelige fils stoerrelse, saa vi kan vise hvad der blev sparet. */
	kildeBytes: number;
	kildeBredde: number;
	kildeHoejde: number;
}

/**
 * Laeser filen som et billede. Kaster med en besked Linn kan forstaa hvis
 * browseren ikke kan aabne filtypen.
 *
 * Det sker i praksis med HEIC fra en iPhone aabnet i Chrome paa Mac. Vaelger
 * hun billedet paa selve telefonen, laver iOS om til jpeg undervejs, og saa
 * er der ingen problemer.
 */
export function laesBillede(fil: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(fil);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			const type = fil.type || 'ukendt type';
			reject(
				new Error(
					`Browseren kan ikke åbne ${fil.name} (${type}). ` +
						'Er det et HEIC-billede fra en iPhone, så vælg det på selve telefonen, ' +
						'eller gem det som JPEG først.'
				)
			);
		};
		img.src = url;
	});
}

/**
 * Tegner billedet ned i én stoerrelse og pakker det som webp, med jpeg som
 * reserve.
 *
 * FAELDEN: beder man en browser der ikke kan webp om webp, faar man ikke en
 * fejl. Man faar en PNG, som er STOERRE end den jpeg man ville have haft. Man
 * tror man har sparet og har gjort det vaerre. Derfor spoerger vi hvad der
 * faktisk kom ud, se formatDuger, og laver en jpeg hvis svaret ikke duer.
 */
export async function skalerTil(
	img: HTMLImageElement,
	stoerrelse: Billedstoerrelse
): Promise<Skaleret> {
	const spec = STOERRELSER[stoerrelse];
	const maal = nyeMaal(img.naturalWidth, img.naturalHeight, spec.maxDim);

	const canvas = document.createElement('canvas');
	canvas.width = maal.bredde;
	canvas.height = maal.hoejde;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Kunne ikke behandle billedet i denne browser.');
	ctx.drawImage(img, 0, 0, maal.bredde, maal.hoejde);

	const tegn = (mime: string) =>
		new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, spec.kvalitet));

	let blob = await tegn('image/webp');
	if (!blob || !formatDuger(blob.type)) {
		blob = await tegn('image/jpeg');
	}
	if (!blob) throw new Error('Kunne ikke behandle billedet i denne browser.');

	return {
		blob,
		bredde: maal.bredde,
		hoejde: maal.hoejde,
		mime: blob.type,
		endelse: endelseFor(blob.type)
	};
}

/** Begge stoerrelser ud af én valgt fil. */
export async function forberedBillede(fil: File): Promise<BilledeSaet> {
	const img = await laesBillede(fil);
	const [lille, stor] = await Promise.all([skalerTil(img, 'lille'), skalerTil(img, 'stor')]);
	return {
		lille,
		stor,
		kildeBytes: fil.size,
		kildeBredde: img.naturalWidth,
		kildeHoejde: img.naturalHeight
	};
}
