import { describe, it, expect } from 'vitest';
import {
	dagbogsNavn,
	filtrerMine,
	gaetKategorier,
	harEgne,
	ingrediensMaengde,
	kategorierFor,
	makroFor,
	makroForPortioner,
	tilListePost,
	tilUdkast,
	arkBillede,
	fliseBillede,
	fraAiSvar,
	fraUdkast,
	hvadMangler,
	talFra,
	talTil,
	tomIngrediens,
	udkastDuger,
	type BrugtOpskrift,
	type MinOpskrift3
} from './mineOpskrifter3';
import type { Kategori3 } from './opskriftKategori3';

function min(
	id: string,
	navn: string,
	opts: Partial<MinOpskrift3> = {}
): MinOpskrift3 {
	return {
		id,
		navn,
		antalPortioner: 1,
		ingredienser: [{ navn: 'Hokkaido', maengde: 600, enhed: 'g' }],
		makroPrPortion: { protein: 18, fiber: 7, kh: 30, fedt: 12, kcal: 340 },
		...opts
	};
}

/** Et maaltid hvor hun har logget en af sine egne opskrifter. */
function logget(type: string, opskriftId: string): BrugtOpskrift {
	return { type, items: [{ opskriftRef: { id: opskriftId, erEgen: true } }] };
}

function post(m: MinOpskrift3, k: Kategori3[] = []) {
	return tilListePost(m, k);
}

describe('gaetKategorier', () => {
	it('gaetter ud af det hun faktisk har logget den som', () => {
		const g = gaetKategorier([logget('frokost', 'a'), logget('frokost', 'a')]);
		expect(g.get('a')).toEqual(['frokost']);
	});

	// En suppe kan sagtens vaere baade frokost og aftensmad.
	it('giver flere maaltider naar hun bruger den til flere', () => {
		const g = gaetKategorier([logget('aftensmad', 'a'), logget('frokost', 'a')]);
		expect(g.get('a')).toEqual(['frokost', 'aftensmad']);
	});

	it('holder to opskrifter adskilt', () => {
		const g = gaetKategorier([logget('morgenmad', 'a'), logget('aftensmad', 'b')]);
		expect(g.get('a')).toEqual(['morgenmad']);
		expect(g.get('b')).toEqual(['aftensmad']);
	});

	// Kun hendes EGNE. Linns opskrifter skrives med erEgen: false.
	it('taeller ikke Linns opskrifter med', () => {
		const g = gaetKategorier([
			{ type: 'frokost', items: [{ opskriftRef: { id: 'linns', erEgen: false } }] }
		]);
		expect(g.size).toBe(0);
	});

	it('taeller ikke almindelige madvarer med', () => {
		expect(gaetKategorier([{ type: 'frokost', items: [{}] }]).size).toBe(0);
	});

	it('springer et ukendt maaltid over', () => {
		expect(gaetKategorier([logget('natmad', 'a')].map((m) => m)).size).toBe(0);
	});
});

describe('kategorierFor', () => {
	const gaet = new Map<string, Kategori3[]>([['a', ['frokost']]]);

	it('lader hendes eget valg vinde over gaettet', () => {
		expect(kategorierFor(min('a', 'Suppe', { kategorier3: ['aftensmad'] }), gaet)).toEqual([
			'aftensmad'
		]);
	});

	// De 222 fra den gamle app har intet felt.
	it('falder tilbage paa gaettet naar feltet mangler', () => {
		expect(kategorierFor(min('a', 'Suppe'), gaet)).toEqual(['frokost']);
	});

	it('giver ingen naar der hverken er felt eller historik', () => {
		expect(kategorierFor(min('z', 'Ukendt'), gaet)).toEqual([]);
	});

	it('saetter altid maaltiderne i fast raekkefoelge', () => {
		const k = kategorierFor(min('a', 'Suppe', { kategorier3: ['aftensmad', 'morgenmad'] }), gaet);
		expect(k).toEqual(['morgenmad', 'aftensmad']);
	});

	it('smider vaerdier vi ikke kender vaek', () => {
		const k = kategorierFor(
			min('a', 'Suppe', { kategorier3: ['natmad' as Kategori3, 'frokost'] }),
			undefined
		);
		expect(k).toEqual(['frokost']);
	});
});

describe('tilListePost', () => {
	it('goer opskriften soegbar paa titel og ingredienser', () => {
		const p = post(min('a', 'Mors græskarsuppe'), ['frokost']);
		expect(p.titel).toBe('Mors græskarsuppe');
		expect(p.ingredienser).toEqual([{ navn: 'Hokkaido' }]);
		expect(p.kategorier3).toEqual(['frokost']);
	});

	// Hun har ingen diaet-maerker, saa kost-filteret maa aldrig ramme hende
	// paa noget andet end at hun ikke har maerket.
	it('giver tomme diaet-maerker', () => {
		expect(post(min('a', 'Suppe')).dietTags).toEqual([]);
	});
});

describe('filtrerMine', () => {
	const suppe = post(min('a', 'Mors græskarsuppe'), ['frokost']);
	const gryde = post(min('b', 'Kikærtegryde'), ['aftensmad']);
	// Den her har intet maaltid. Det er de 222 fra den gamle app.
	const uden = post(min('c', 'Havregrød med æble'), []);
	const alle = [suppe, gryde, uden];

	it('filtrerer paa maaltid som alt andet', () => {
		const r = filtrerMine(alle, { kategorier: ['frokost'] });
		expect(r.map((x) => x.opskrift.id)).toContain('a');
		expect(r.map((x) => x.opskrift.id)).not.toContain('b');
	});

	// Den vigtigste test i filen. Hendes egen mad maa ikke forsvinde fordi
	// hun aldrig er blevet bedt om at udfylde et felt.
	it('viser ALTID en opskrift uden maaltid, uanset filteret', () => {
		const r = filtrerMine(alle, { kategorier: ['frokost'] });
		expect(r.map((x) => x.opskrift.id)).toContain('c');
	});

	it('viser den uden maaltid ogsaa naar filteret er noget helt andet', () => {
		const r = filtrerMine(alle, { kategorier: ['snack'] });
		expect(r.map((x) => x.opskrift.id)).toEqual(['c']);
	});

	// Soegningen gaelder ogsaa dem. Det er KUN maaltidet der springes over.
	it('soegningen gaelder ogsaa dem uden maaltid', () => {
		const r = filtrerMine(alle, { soegeord: 'græskar' });
		expect(r.map((x) => x.opskrift.id)).toEqual(['a']);
	});

	it('finder paa en ingrediens', () => {
		const r = filtrerMine(alle, { soegeord: 'hokkaido' });
		expect(r.length).toBe(3);
	});

	it('bevarer raekkefoelgen fra listen', () => {
		const r = filtrerMine(alle, {});
		expect(r.map((x) => x.opskrift.id)).toEqual(['a', 'b', 'c']);
	});

	it('giver alt naar der ikke er filtre', () => {
		expect(filtrerMine(alle, {}).length).toBe(3);
	});
});

describe('harEgne', () => {
	// Har hun ingen, findes fanen slet ikke. 91 % af kunderne.
	it('siger nej naar listen er tom', () => {
		expect(harEgne([])).toBe(false);
	});

	it('siger ja fra den foerste', () => {
		expect(harEgne([post(min('a', 'Suppe'))])).toBe(true);
	});
});

describe('portioner og makro', () => {
	// Samme regel som paa Linns opskrifter: makroen er PR PORTION og
	// ganges. antalPortioner maa ALDRIG bruges paa den. Se SPEC 26.9.
	it('ganger makroen med antallet af portioner', () => {
		expect(makroForPortioner(18, 2)).toBe(36);
	});

	it('roerer ikke makroen ved én portion', () => {
		expect(makroForPortioner(18, 1)).toBe(18);
	});

	it('taaler en halv portion', () => {
		expect(makroForPortioner(18, 0.5)).toBe(9);
	});

	it('bruger ALDRIG antalPortioner paa makroen', () => {
		// Opskriften raekker til fire, men makroen er stadig pr portion.
		const m = min('a', 'Gryde', { antalPortioner: 4 });
		expect(makroFor(m, 1).protein).toBe(18);
		expect(makroFor(m, 2).protein).toBe(36);
	});

	it('regner alle fem tal', () => {
		const m = makroFor(min('a', 'Suppe'), 2);
		expect(m).toEqual({ protein: 36, fiber: 14, kh: 60, fedt: 24, kcal: 680 });
	});

	// Ingredienserne gaar den ANDEN vej: listen raekker til antalPortioner.
	it('halverer maengderne naar listen er til fire og hun vil have to', () => {
		expect(ingrediensMaengde(600, 4, 2)).toBe(300);
	});

	it('roerer ikke maengden naar listen passer til det hun vil have', () => {
		expect(ingrediensMaengde(600, 1, 1)).toBe(600);
	});

	it('fordobler naar hun vil have to og listen er til én', () => {
		expect(ingrediensMaengde(600, 1, 2)).toBe(1200);
	});

	it('taaler at antalPortioner mangler', () => {
		expect(ingrediensMaengde(600, 0, 2)).toBe(600);
	});
});

describe('dagbogsNavn', () => {
	it('skriver bare navnet ved én portion', () => {
		expect(dagbogsNavn(min('a', 'Mors græskarsuppe'), 1)).toBe('Mors græskarsuppe');
	});

	it('skriver antallet med naar det ikke er én', () => {
		expect(dagbogsNavn(min('a', 'Mors græskarsuppe'), 2)).toBe('Mors græskarsuppe (2 port.)');
	});

	it('skriver en halv portion med komma', () => {
		expect(dagbogsNavn(min('a', 'Suppe'), 0.5)).toBe('Suppe (0,5 port.)');
	});
});

describe('at rette i en opskrift', () => {
	const suppe = min('a', 'Mors græskarsuppe', {
		antalPortioner: 4,
		beskrivelse: 'Den gode',
		ingredienser: [
			{ navn: 'Hokkaido', maengde: 600, enhed: 'g' },
			{ navn: 'Ingefær', maengde: 1.5, enhed: 'spsk' }
		]
	});

	describe('talFra', () => {
		// Dansk komma SKAL virke. Skriver hun 1,5 spsk er det halvanden.
		it('laeser dansk komma', () => {
			expect(talFra('1,5')).toBe(1.5);
		});

		it('laeser almindeligt punktum ogsaa', () => {
			expect(talFra('1.5')).toBe(1.5);
		});

		it('taaler mellemrum', () => {
			expect(talFra(' 600 ')).toBe(600);
		});

		// Et halvfaerdigt felt maa ALDRIG blive til NaN i hendes dagbog.
		it('giver nul paa tomt og volapyk', () => {
			expect(talFra('')).toBe(0);
			expect(talFra('abc')).toBe(0);
		});

		// Midt i "1,5" staar der et oejeblik "1,". Det skal give 1 og ikke
		// nul, ellers nulstiller vi hendes tal mens hun skriver det.
		it('taaler et komma der ikke er skrevet faerdigt', () => {
			expect(talFra('1,')).toBe(1);
		});

		it('giver nul paa negative tal', () => {
			expect(talFra('-5')).toBe(0);
		});
	});

	it('talTil giver dansk komma tilbage', () => {
		expect(talTil(1.5)).toBe('1,5');
		expect(talTil(600)).toBe('600');
		expect(talTil(undefined)).toBe('');
	});

	it('kan gaa frem og tilbage uden at miste noget', () => {
		const tilbage = fraUdkast(tilUdkast(suppe));
		expect(tilbage.navn).toBe('Mors græskarsuppe');
		expect(tilbage.antalPortioner).toBe(4);
		expect(tilbage.ingredienser).toEqual(suppe.ingredienser);
		expect(tilbage.makroPrPortion).toEqual(suppe.makroPrPortion);
	});

	// Hun faar en tom linje naar hun trykker tilfoej. Traekker hun sig,
	// skal den ikke gemmes som en ingrediens uden navn.
	it('smider tomme ingrediens-linjer vaek', () => {
		const u = tilUdkast(suppe);
		u.ingredienser.push(tomIngrediens());
		expect(fraUdkast(u).ingredienser.length).toBe(2);
	});

	it('trimmer navnet og klemmer mellemrum sammen', () => {
		const u = tilUdkast(suppe);
		u.navn = '  Mors   græskarsuppe  ';
		expect(fraUdkast(u).navn).toBe('Mors græskarsuppe');
	});

	it('falder tilbage til gram naar enheden er tom', () => {
		const u = tilUdkast(suppe);
		u.ingredienser[0].enhed = '';
		expect(fraUdkast(u).ingredienser[0].enhed).toBe('g');
	});

	it('kan aldrig gemme under én portion', () => {
		const u = tilUdkast(suppe);
		u.antalPortioner = 0;
		expect(fraUdkast(u).antalPortioner).toBe(1);
	});

	it('runder kalorier til et helt tal', () => {
		const u = tilUdkast(suppe);
		u.makro.kcal = '340,6';
		expect(fraUdkast(u).makroPrPortion.kcal).toBe(341);
	});

	it('kraever et navn', () => {
		const u = tilUdkast(suppe);
		u.navn = '   ';
		expect(udkastDuger(u)).toBe(false);
		expect(hvadMangler(u)).toContain('navn');
	});

	// Hun kan have en opskrift hun kun bruger som huskeseddel. At spaerre
	// for den ville vaere at bestemme over hendes egen mad.
	it('tillader en opskrift helt uden makro', () => {
		const u = tilUdkast(min('b', 'Huskeseddel'));
		u.makro = { protein: '', fiber: '', kh: '', fedt: '', kcal: '' };
		expect(udkastDuger(u)).toBe(true);
		expect(fraUdkast(u).makroPrPortion.protein).toBe(0);
	});
});

describe('fraAiSvar', () => {
	const godt = {
		navn: 'Mors græskarsuppe',
		antalPortioner: 4,
		ingredienser: [
			{ navn: 'Hokkaido', maengde: 600, enhed: 'g' },
			{ navn: 'Ingefær', maengde: 1.5, enhed: 'spsk' }
		],
		makroPrPortion: { protein: 18, fiber: 7, kh: 34, fedt: 12, kcal: 340 }
	};

	it('laeser et almindeligt svar', () => {
		const r = fraAiSvar(godt);
		expect(r.fejl).toBeUndefined();
		expect(r.udkast?.navn).toBe('Mors græskarsuppe');
		expect(r.udkast?.antalPortioner).toBe(4);
		expect(r.udkast?.ingredienser.length).toBe(2);
		expect(r.udkast?.makro.protein).toBe('18');
	});

	it('giver dansk komma tilbage i felterne', () => {
		expect(fraAiSvar(godt).udkast?.ingredienser[1].maengde).toBe('1,5');
	});

	// Modellen svarer med error naar billedet ikke er en opskrift.
	it('siger pænt fra naar billedet ikke er en opskrift', () => {
		const r = fraAiSvar({ error: 'Billedet indeholder ikke en madopskrift' });
		expect(r.udkast).toBeUndefined();
		expect(r.fejl).toContain('opskrift');
	});

	it('siger fra naar der slet ikke kom et svar', () => {
		expect(fraAiSvar(null).fejl).toBeTruthy();
		expect(fraAiSvar('noget tekst').fejl).toBeTruthy();
	});

	// Alt herunder er svar en model kan finde paa at give. Ingen af dem
	// maa vaelte skaermen, for hun har lige taget et billede.
	it('giver den et navn naar modellen glemte det', () => {
		const r = fraAiSvar({ ...godt, navn: undefined });
		expect(r.udkast?.navn).toBe('Min opskrift');
	});

	it('taaler at ingredienserne mangler helt', () => {
		const r = fraAiSvar({ ...godt, ingredienser: undefined });
		// Én tom linje at skrive i, saa skaermen ikke staar bar.
		expect(r.udkast?.ingredienser.length).toBe(1);
		expect(r.udkast?.ingredienser[0].navn).toBe('');
	});

	it('taaler tal der kommer som tekst', () => {
		const r = fraAiSvar({
			...godt,
			antalPortioner: '4',
			makroPrPortion: { protein: '18', fiber: '7', kh: '34', fedt: '12', kcal: '340' }
		});
		expect(r.udkast?.antalPortioner).toBe(4);
		expect(r.udkast?.makro.protein).toBe('18');
	});

	it('smider ingredienser uden navn vaek', () => {
		const r = fraAiSvar({ ...godt, ingredienser: [{ maengde: 100, enhed: 'g' }, ...godt.ingredienser] });
		expect(r.udkast?.ingredienser.length).toBe(2);
	});

	it('falder tilbage til gram naar enheden mangler', () => {
		const r = fraAiSvar({ ...godt, ingredienser: [{ navn: 'Salt' }] });
		expect(r.udkast?.ingredienser[0].enhed).toBe('g');
	});

	it('kan aldrig give under én portion', () => {
		expect(fraAiSvar({ ...godt, antalPortioner: 0 }).udkast?.antalPortioner).toBe(1);
	});

	it('taaler at makroen mangler helt', () => {
		const r = fraAiSvar({ ...godt, makroPrPortion: undefined });
		expect(r.udkast?.makro.protein).toBe('0');
	});

	it('giver et udkast der kan gemmes med det samme', () => {
		expect(udkastDuger(fraAiSvar(godt).udkast!)).toBe(true);
	});
});

describe('billederne', () => {
	// billedeUrl er fotoet af selve OPSKRIFTEN, altsaa kogebogssiden.
	// madBilledeUrl er hendes foto af RETTEN. De to er ikke det samme, og
	// det foerste maa aldrig erstattes: der gemmes ingen fremgangsmaade,
	// saa det er hendes eneste opskrift paa hvordan retten laves.
	it('viser opskrift-fotoet naar hun ikke har taget et af retten', () => {
		const m = min('a', 'Suppe', { billedeUrl: 'opskrift.jpg' });
		expect(arkBillede(m)).toBe('opskrift.jpg');
		expect(fliseBillede(m)).toBe('opskrift.jpg');
	});

	it('lader billedet af retten vinde naar hun har taget et', () => {
		const m = min('a', 'Suppe', {
			billedeUrl: 'opskrift.jpg',
			madBilledeUrl: 'ret.jpg',
			madBilledeUrlLille: 'ret-lille.jpg'
		});
		expect(arkBillede(m)).toBe('ret.jpg');
		expect(fliseBillede(m)).toBe('ret-lille.jpg');
	});

	// Flisen er 62 px hoej. Den skal have den lille, ellers henter den
	// 38 KB hvor 17 raekker. Se SPEC 26.7.
	it('flisen tager den lille udgave naar den findes', () => {
		const m = min('a', 'Suppe', { madBilledeUrl: 'stor.jpg', madBilledeUrlLille: 'lille.jpg' });
		expect(fliseBillede(m)).toBe('lille.jpg');
	});

	it('falder tilbage til den store hvis den lille mangler', () => {
		const m = min('a', 'Suppe', { madBilledeUrl: 'stor.jpg' });
		expect(fliseBillede(m)).toBe('stor.jpg');
	});

	it('giver null naar der slet ikke er noget billede', () => {
		expect(arkBillede(min('a', 'Suppe'))).toBeNull();
		expect(fliseBillede(min('a', 'Suppe'))).toBeNull();
	});
});
