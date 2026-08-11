import { describe, it, expect } from 'vitest';
import {
	STOERRELSER,
	formatDuger,
	endelseFor,
	billedeSti,
	nyeMaal,
	vaegtTekst,
	sparetProcent,
	harBillede,
	manglerLille,
	sorterTilAdmin,
	taelBilleder,
	type BilledePost
} from './opskriftBillede3';

const post = (o: Partial<BilledePost> & { titel: string }): BilledePost => ({
	id: o.id ?? 'x',
	titel: o.titel,
	billedeUrl: o.billedeUrl ?? null,
	billedeUrlLille: o.billedeUrlLille ?? null
});

describe('STOERRELSER', () => {
	it('den lille er mindre end den store', () => {
		expect(STOERRELSER.lille.maxDim).toBeLessThan(STOERRELSER.stor.maxDim);
	});

	// Flisen er 170 px bred, altsaa 510 paa en 3x-skaerm.
	it('den lille daekker flisen paa en 3x-skaerm', () => {
		expect(STOERRELSER.lille.maxDim).toBeGreaterThanOrEqual(480);
	});

	// Den gamle opskrift-side beder om 800 px. Bliver den store mindre end
	// det, faar 760 kunder i drift sloerede billeder.
	it('den store daekker den gamle apps 800 px', () => {
		expect(STOERRELSER.stor.maxDim).toBeGreaterThanOrEqual(800);
	});
});

describe('formatDuger', () => {
	// Faelden: en browser uden webp giver en PNG i stedet for en fejl.
	it('siger ja kun til webp', () => {
		expect(formatDuger('image/webp')).toBe(true);
		expect(formatDuger('IMAGE/WEBP')).toBe(true);
	});

	it('siger nej til png, som er det man faar naar webp ikke duer', () => {
		expect(formatDuger('image/png')).toBe(false);
	});

	it('siger nej til jpeg og til ingenting', () => {
		expect(formatDuger('image/jpeg')).toBe(false);
		expect(formatDuger(undefined)).toBe(false);
		expect(formatDuger('')).toBe(false);
	});
});

describe('endelseFor', () => {
	it('kender de tre formater', () => {
		expect(endelseFor('image/webp')).toBe('webp');
		expect(endelseFor('image/png')).toBe('png');
		expect(endelseFor('image/jpeg')).toBe('jpg');
	});

	it('falder tilbage til jpg ved noget ukendt', () => {
		expect(endelseFor('image/tiff')).toBe('jpg');
		expect(endelseFor('')).toBe('jpg');
	});
});

describe('billedeSti', () => {
	it('laver et navn man kan kende i Console', () => {
		expect(billedeSti('Den grønne grød', 'abc123xyz', 'lille', 'webp')).toBe(
			'opskrifter/den-groenne-groed-abc123-lille.webp'
		);
	});

	it('folder danske bogstaver', () => {
		expect(billedeSti('Æggewrap', 'id1234', 'stor', 'jpg')).toBe(
			'opskrifter/aeggewrap-id1234-stor.jpg'
		);
	});

	it('holder de to stoerrelser adskilt', () => {
		const l = billedeSti('Grøn grød', 'aaa111', 'lille', 'webp');
		const s = billedeSti('Grøn grød', 'aaa111', 'stor', 'webp');
		expect(l).not.toBe(s);
	});

	// To opskrifter kan hedde det samme. Uden id'et ville den ene skrive
	// oven i den anden.
	it('adskiller to opskrifter med samme titel', () => {
		expect(billedeSti('Grøn grød', 'aaa111', 'lille', 'webp')).not.toBe(
			billedeSti('Grøn grød', 'bbb222', 'lille', 'webp')
		);
	});

	it('klipper en meget lang titel', () => {
		const sti = billedeSti(
			'Plancha grøntsager med flankesteak, asiatisk kartoffelsalat og peanut-lime dressing',
			'zzz999',
			'stor',
			'webp'
		);
		expect(sti.length).toBeLessThan(80);
		expect(sti.startsWith('opskrifter/plancha-groentsager')).toBe(true);
	});

	it('ender aldrig paa en bindestreg foer id-delen', () => {
		expect(billedeSti('Mad!!!   ', 'id0000', 'lille', 'webp')).toBe(
			'opskrifter/mad-id0000-lille.webp'
		);
	});

	it('taaler en tom titel', () => {
		expect(billedeSti('', 'id0000', 'lille', 'webp')).toBe('opskrifter/opskrift-id0000-lille.webp');
	});
});

describe('nyeMaal', () => {
	it('skalerer et liggende billede ned efter bredden', () => {
		expect(nyeMaal(4032, 3024, 1000)).toEqual({ bredde: 1000, hoejde: 750 });
	});

	it('skalerer et staaende billede ned efter hoejden', () => {
		expect(nyeMaal(3024, 4032, 1000)).toEqual({ bredde: 750, hoejde: 1000 });
	});

	it('lader et kvadrat blive et kvadrat', () => {
		expect(nyeMaal(2000, 2000, 480)).toEqual({ bredde: 480, hoejde: 480 });
	});

	// Et lille billede maa ALDRIG blaeses op. Saa bliver filen stoerre og
	// billedet grimmere paa én gang.
	it('skalerer aldrig op', () => {
		expect(nyeMaal(300, 200, 1000)).toEqual({ bredde: 300, hoejde: 200 });
	});

	it('taaler nul', () => {
		expect(nyeMaal(0, 0, 480)).toEqual({ bredde: 0, hoejde: 0 });
	});
});

describe('vaegtTekst', () => {
	it('skriver bytes, KB og MB', () => {
		expect(vaegtTekst(512)).toBe('512 B');
		expect(vaegtTekst(17 * 1024)).toBe('17 KB');
		expect(vaegtTekst(2.4 * 1024 * 1024)).toBe('2.4 MB');
	});

	it('taaler ingenting', () => {
		expect(vaegtTekst(0)).toBe('0 B');
		expect(vaegtTekst(NaN)).toBe('—');
		expect(vaegtTekst(-5)).toBe('—');
	});
});

describe('sparetProcent', () => {
	it('regner besparelsen', () => {
		expect(sparetProcent(2_400_000, 55_000)).toBe(98);
		expect(sparetProcent(1000, 500)).toBe(50);
	});

	it('giver nul hvis den ikke blev mindre', () => {
		expect(sparetProcent(1000, 1000)).toBe(0);
		expect(sparetProcent(1000, 1500)).toBe(0);
	});

	it('taaler nul og noget forkert', () => {
		expect(sparetProcent(0, 100)).toBe(0);
		expect(sparetProcent(NaN, 100)).toBe(0);
	});
});

describe('harBillede og manglerLille', () => {
	it('kender de tre tilstande', () => {
		const uden = post({ titel: 'A' });
		const kunStor = post({ titel: 'B', billedeUrl: 'https://x' });
		const hel = post({ titel: 'C', billedeUrl: 'https://x', billedeUrlLille: 'https://y' });

		expect(harBillede(uden)).toBe(false);
		expect(harBillede(kunStor)).toBe(true);
		expect(harBillede(hel)).toBe(true);

		expect(manglerLille(uden)).toBe(false);
		expect(manglerLille(kunStor)).toBe(true);
		expect(manglerLille(hel)).toBe(false);
	});
});

describe('sorterTilAdmin', () => {
	const LISTE = [
		post({ id: '1', titel: 'Zebra', billedeUrl: 'u', billedeUrlLille: 'l' }),
		post({ id: '2', titel: 'Banan' }),
		post({ id: '3', titel: 'Citron', billedeUrl: 'u' }),
		post({ id: '4', titel: 'Agurk' }),
		post({ id: '5', titel: 'Ærte', billedeUrl: 'u', billedeUrlLille: 'l' })
	];

	it('saetter manglende foerst, saa kun-stor, saa faerdige', () => {
		expect(sorterTilAdmin(LISTE).map((o) => o.titel)).toEqual([
			'Agurk',
			'Banan',
			'Citron',
			'Zebra',
			'Ærte'
		]);
	});

	it('sorterer med dansk alfabet, saa Æ kommer efter Z', () => {
		const kun = [post({ titel: 'Ærte', billedeUrl: 'u', billedeUrlLille: 'l' }), post({ titel: 'Zebra', billedeUrl: 'u', billedeUrlLille: 'l' })];
		expect(sorterTilAdmin(kun).map((o) => o.titel)).toEqual(['Zebra', 'Ærte']);
	});

	it('aendrer ikke listen den fik', () => {
		const foer = LISTE.map((o) => o.titel);
		sorterTilAdmin(LISTE);
		expect(LISTE.map((o) => o.titel)).toEqual(foer);
	});

	it('taaler en tom liste', () => {
		expect(sorterTilAdmin([])).toEqual([]);
	});
});

describe('taelBilleder', () => {
	it('taeller de fire tal', () => {
		const t = taelBilleder([
			post({ titel: 'A' }),
			post({ titel: 'B', billedeUrl: 'u' }),
			post({ titel: 'C', billedeUrl: 'u', billedeUrlLille: 'l' }),
			post({ titel: 'D' })
		]);
		expect(t).toEqual({ ialt: 4, medBillede: 2, uden: 2, kunStor: 1, procent: 50 });
	});

	it('taaler en tom liste uden at dividere med nul', () => {
		expect(taelBilleder([])).toEqual({ ialt: 0, medBillede: 0, uden: 0, kunStor: 0, procent: 0 });
	});

	// Sådan ser det ud i dag: 2 af 130, og begge mangler den lille.
	it('rammer virkeligheden 11. august', () => {
		const liste = [
			...Array.from({ length: 128 }, (_, i) => post({ titel: `Uden ${i}` })),
			post({ titel: 'Tinnas', billedeUrl: 'u' }),
			post({ titel: 'Winnis', billedeUrl: 'u' })
		];
		const t = taelBilleder(liste);
		expect(t.ialt).toBe(130);
		expect(t.medBillede).toBe(2);
		expect(t.kunStor).toBe(2);
		expect(t.procent).toBe(2);
	});
});
