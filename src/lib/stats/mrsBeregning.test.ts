import { describe, it, expect } from 'vitest';
import {
	bygKunde,
	distillerKunde,
	faseInddel,
	byggSamletRejse,
	type MrsDoc,
	type FaseKunde
} from './mrsBeregning';

const DAG = 86400000;
// Realistiske epoch-ms saa 3-dages-bufferen i distillerKunde er lille ift.
// afstanden mellem forloebene.
const KICK_START = 1_780_000_000_000;
const KROP_START = KICK_START + 30 * DAG;

const sliderDoc = (ts: number, v: number): MrsDoc => ({
	timestamp: ts,
	sliders: { energi: v, mave: v, cravings: v, humor: v, sovn: v }
});
const mrsDoc = (ts: number, total: number): MrsDoc => ({ timestamp: ts, total });

// Byg ét fase-segment (KundeMrs) af en raekke velvaere-vaerdier.
const velvaereSeg = (vals: number[], startTs: number) =>
	bygKunde(
		vals.map((v, i) => sliderDoc(startTs + i * DAG, v)),
		undefined,
		undefined
	);
const mrsSeg = (vals: number[], startTs: number) =>
	bygKunde(
		vals.map((v, i) => mrsDoc(startTs + i * DAG, v)),
		undefined,
		undefined
	);

describe('faseInddel', () => {
	const forlobStart = new Map<string, number>([
		['kickstart_maj_2026', KICK_START],
		['kropsro_maj_2026', KROP_START]
	]);

	it('deler en kickstart->kropsro-kundes maalinger i to fase-segmenter', () => {
		const docs = [
			sliderDoc(KICK_START, 5),
			sliderDoc(KICK_START + 7 * DAG, 6),
			sliderDoc(KROP_START, 7),
			sliderDoc(KROP_START + 28 * DAG, 8)
		];
		const bidrag = distillerKunde(
			docs,
			['kickstart_maj_2026', 'kropsro_maj_2026'],
			forlobStart,
			{}
		);
		const fk = faseInddel(bidrag, forlobStart);
		expect(fk.kickstart?.sliderMaalinger.length).toBe(2);
		expect(fk.kropsro?.sliderMaalinger.length).toBe(2);
	});

	it('giver null for en fase kunden ikke har', () => {
		const docs = [sliderDoc(KICK_START, 5), sliderDoc(KICK_START + 7 * DAG, 6)];
		const bidrag = distillerKunde(docs, ['kickstart_maj_2026'], forlobStart, {});
		const fk = faseInddel(bidrag, forlobStart);
		expect(fk.kickstart).not.toBeNull();
		expect(fk.kropsro).toBeNull();
	});

	it('vaelger det senest startede forloeb hvis kunden har flere i samme fase', () => {
		const start = new Map<string, number>([
			['kickstart_maj_2026', KICK_START],
			['kickstart_juni_2026', KICK_START + 40 * DAG]
		]);
		const bidrag = [
			{ forlobId: 'kickstart_maj_2026', kunde: velvaereSeg([3], KICK_START) },
			{
				forlobId: 'kickstart_juni_2026',
				kunde: velvaereSeg([9, 9], KICK_START + 40 * DAG)
			}
		];
		const fk = faseInddel(bidrag, start);
		// Det seneste (juni) skal vaelges → 2 maalinger, ikke 1.
		expect(fk.kickstart?.sliderMaalinger.length).toBe(2);
	});
});

describe('byggSamletRejse — velvaere', () => {
	// A: begge faser med udvikling. B: kun 1 kickstart-maaling. C: kun kropsro.
	const A: FaseKunde = {
		kickstart: velvaereSeg([5, 6], KICK_START),
		kropsro: velvaereSeg([7, 8], KROP_START)
	};
	const B: FaseKunde = { kickstart: velvaereSeg([4], KICK_START), kropsro: null };
	const C: FaseKunde = { kickstart: null, kropsro: velvaereSeg([9, 9], KROP_START) };
	const rejse = byggSamletRejse([A, B, C], 'velvaere');

	it('alleIHverFase: kickstart-benet rummer alle med kickstart-segment (A + B)', () => {
		const kick = rejse.alleIHverFase.filter((p) => p.fase === 'kickstart');
		// index 0 = A(5) + B(4) → gns 4.5, n=2
		expect(kick[0]).toEqual({ fase: 'kickstart', index: 0, gns: 4.5, antal: 2 });
		// index 1 = kun A(6) → gns 6, n=1
		expect(kick[1]).toEqual({ fase: 'kickstart', index: 1, gns: 6, antal: 1 });
	});

	it('alleIHverFase: kropsro-benet rummer alle med kropsro-segment (A + C)', () => {
		const krop = rejse.alleIHverFase.filter((p) => p.fase === 'kropsro');
		// index 0 = A(7) + C(9) → gns 8, n=2
		expect(krop[0]).toEqual({ fase: 'kropsro', index: 0, gns: 8, antal: 2 });
		// index 1 = A(8) + C(9) → gns 8.5, n=2
		expect(krop[1]).toEqual({ fase: 'kropsro', index: 1, gns: 8.5, antal: 2 });
	});

	it('beggeFaser: kun A (udvikling i begge faser)', () => {
		const kick = rejse.beggeFaser.filter((p) => p.fase === 'kickstart');
		const krop = rejse.beggeFaser.filter((p) => p.fase === 'kropsro');
		expect(kick.map((p) => [p.gns, p.antal])).toEqual([
			[5, 1],
			[6, 1]
		]);
		expect(krop.map((p) => [p.gns, p.antal])).toEqual([
			[7, 1],
			[8, 1]
		]);
	});

	it('rejsen er ordnet: alle kickstart-punkter foer alle kropsro-punkter', () => {
		const faser = rejse.alleIHverFase.map((p) => p.fase);
		const sidsteKick = faser.lastIndexOf('kickstart');
		const foersteKrop = faser.indexOf('kropsro');
		expect(sidsteKick).toBeLessThan(foersteKrop);
	});
});

describe('byggSamletRejse — mrs', () => {
	// MRS: lavere = bedre. Serie = de fulde totaler.
	const A: FaseKunde = {
		kickstart: mrsSeg([20, 16], KICK_START),
		kropsro: mrsSeg([14, 10], KROP_START)
	};
	const B: FaseKunde = { kickstart: mrsSeg([18], KICK_START), kropsro: null };
	const rejse = byggSamletRejse([A, B], 'mrs');

	it('bruger MRS-totaler som vaerdi-serie', () => {
		const kick = rejse.alleIHverFase.filter((p) => p.fase === 'kickstart');
		// index 0 = A(20) + B(18) → gns 19, n=2
		expect(kick[0]).toEqual({ fase: 'kickstart', index: 0, gns: 19, antal: 2 });
	});

	it('beggeFaser kraever >=2 MRS-maalinger i hver fase (kun A)', () => {
		const krop = rejse.beggeFaser.filter((p) => p.fase === 'kropsro');
		expect(krop.map((p) => p.gns)).toEqual([14, 10]);
		// B er ikke med (ingen kropsro-fase)
		const kick = rejse.beggeFaser.filter((p) => p.fase === 'kickstart');
		expect(kick[0].antal).toBe(1);
	});
});
