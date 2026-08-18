import { describe, it, expect } from 'vitest';
import { byggUger, erQa, temaFraTitel, ugeNavn, seteIUge } from './lektionsUger3';
import type { ListeLektion } from './lektionsliste3';

function post(dagNummer: number, id: string, titel: string, url = ''): ListeLektion {
	return {
		dagNummer,
		lektion: {
			id,
			titel,
			beskrivelse: '',
			varighedMin: 0,
			format: 'video',
			url
		},
		aaben: true,
		aabnerTekst: ''
	};
}

/** Samme fil paa syv dage, sadan som Kropsro ligger. */
function ugeVideo(fraDag: number, titel: string, url: string): ListeLektion[] {
	return Array.from({ length: 7 }, (_, i) => post(fraDag + i, `l${fraDag + i}`, titel, url));
}

describe('erQa', () => {
	it('kender de skrivemaader Linn bruger', () => {
		expect(erQa('Q&A uge 1')).toBe(true);
		expect(erQa('Live Q & A')).toBe(true);
		expect(erQa('Optagelse af q&a')).toBe(true);
	});

	it('tager ikke almindelige lektioner med', () => {
		expect(erQa('Uge 2, Tarmmikrobiomet')).toBe(false);
		expect(erQa('Din 1%')).toBe(false);
	});
});

describe('temaFraTitel', () => {
	it('trakker temaet ud af en uge-titel', () => {
		expect(temaFraTitel('Uge 2, Tarmmikrobiomet')).toBe('Tarmmikrobiomet');
		expect(temaFraTitel('Uge 10: Blodsukker')).toBe('Blodsukker');
		expect(temaFraTitel('uge 3 - Søvn')).toBe('Søvn');
	});

	it('giver null naar titlen ikke navngiver en uge', () => {
		expect(temaFraTitel('Din 1%')).toBe(null);
		expect(temaFraTitel('Velkommen')).toBe(null);
		expect(temaFraTitel('Uge 4')).toBe(null);
	});
});

describe('byggUger, dubletter', () => {
	it('samler samme fil paa syv dage til én linje', () => {
		const { uger } = byggUger(ugeVideo(1, 'Uge 1, Kom godt i gang', 'https://v/1'));
		expect(uger).toHaveLength(1);
		expect(uger[0].poster).toHaveLength(1);
		expect(uger[0].poster[0].dage).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	// Den fejl der ville have skjult 83 lektioner.
	it('beholder alle naar samme titel peger paa forskellige filer', () => {
		const liste = Array.from({ length: 7 }, (_, i) =>
			post(i + 1, `d${i + 1}`, 'Din 1%', `https://lyd/${i + 1}`)
		);
		const { uger } = byggUger(liste);
		expect(uger[0].poster).toHaveLength(7);
	});

	it('giver hver sin plads naar der slet ingen fil er', () => {
		const liste = [post(1, 'a', 'Noget'), post(2, 'b', 'Noget')];
		const { uger } = byggUger(liste);
		expect(uger[0].poster).toHaveLength(2);
	});

	it('lader den foerste dag vinde, saa linket peger paa starten', () => {
		const liste = [
			post(5, 'sen', 'Guide', 'https://v/g'),
			post(2, 'tidlig', 'Guide', 'https://v/g')
		];
		const { uger } = byggUger(liste);
		expect(uger[0].poster[0].post.lektion.id).toBe('tidlig');
		expect(uger[0].poster[0].dage).toEqual([2, 5]);
	});
});

describe('byggUger, Q&A', () => {
	it('tager Q&A ud af ugerne og laegger dem for sig', () => {
		const liste = [...ugeVideo(1, 'Uge 1, Start', 'https://v/1'), post(4, 'q1', 'Q&A uge 1')];
		const { qa, uger } = byggUger(liste);
		expect(qa).toHaveLength(1);
		expect(qa[0].lektion.id).toBe('q1');
		expect(uger[0].poster).toHaveLength(1);
	});

	it('beholder alle Q&A i dagsraekkefoelge', () => {
		const liste = [post(3, 'q1', 'Q&A 1'), post(17, 'q2', 'Q&A 2'), post(31, 'q3', 'Q&A 3')];
		const { qa } = byggUger(liste);
		expect(qa.map((p) => p.dagNummer)).toEqual([3, 17, 31]);
	});
});

describe('byggUger, hvilken uge', () => {
	// Naeste uges lektion udkommer dagen foer. Den skal staa i sin egen uge.
	it('laegger lektionen i den uge hvor den ligger flest dage', () => {
		const dage = [14, 15, 16, 17, 18, 19, 20, 21];
		const liste = dage.map((d) => post(d, `x${d}`, 'Uge 3, Blodsukker', 'https://v/3'));
		const { uger } = byggUger(liste);
		expect(uger).toHaveLength(1);
		expect(uger[0].nummer).toBe(3);
	});

	it('vaelger den tidligste uge naar det staar lige', () => {
		const liste = [7, 8].map((d) => post(d, `x${d}`, 'Midt imellem', 'https://v/m'));
		const { uger } = byggUger(liste);
		expect(uger[0].nummer).toBe(1);
	});

	it('samler dag 0 i sin egen opstart', () => {
		const liste = [post(0, 'v', 'Velkommen'), ...ugeVideo(1, 'Uge 1, Start', 'https://v/1')];
		const { uger } = byggUger(liste);
		expect(uger.map((u) => u.nummer)).toEqual([0, 1]);
	});

	it('sorterer ugerne stigende', () => {
		const liste = [
			...ugeVideo(15, 'Uge 3, Tre', 'https://v/3'),
			...ugeVideo(1, 'Uge 1, En', 'https://v/1'),
			...ugeVideo(8, 'Uge 2, To', 'https://v/2')
		];
		const { uger } = byggUger(liste);
		expect(uger.map((u) => u.nummer)).toEqual([1, 2, 3]);
	});
});

describe('byggUger, navne', () => {
	it('saetter dagen paa naar flere i ugen hedder det samme', () => {
		const liste = [1, 2, 3].map((d) => post(d, `d${d}`, 'Din 1%', `https://lyd/${d}`));
		const { uger } = byggUger(liste);
		expect(uger[0].poster.map((p) => p.navn)).toEqual([
			'Din 1%, dag 1',
			'Din 1%, dag 2',
			'Din 1%, dag 3'
		]);
	});

	it('lader titlen staa ren naar den er alene i ugen', () => {
		const { uger } = byggUger(ugeVideo(1, 'Uge 1, Kom godt i gang', 'https://v/1'));
		expect(uger[0].poster[0].navn).toBe('Uge 1, Kom godt i gang');
	});

	it('tager ugens tema fra den lektion der navngiver ugen', () => {
		const liste = [
			...ugeVideo(8, 'Uge 2, Tarmmikrobiomet', 'https://v/2'),
			post(8, 'ex', 'Øvelse', 'https://v/oe')
		];
		const { uger } = byggUger(liste);
		expect(uger[0].tema).toBe('Tarmmikrobiomet');
		expect(ugeNavn(uger[0])).toBe('Uge 2 · Tarmmikrobiomet');
	});

	it('noejes med uge-nummeret naar intet navngiver ugen', () => {
		const { uger } = byggUger(ugeVideo(8, 'En video', 'https://v/x'));
		expect(ugeNavn(uger[0])).toBe('Uge 2');
	});

	it('kalder dag 0 for opstart', () => {
		const { uger } = byggUger([post(0, 'v', 'Velkommen')]);
		expect(ugeNavn(uger[0])).toBe('Opstart');
	});

	it('sorterer posterne inde i ugen efter foerste dag', () => {
		const liste = [
			post(5, 'sen', 'Sidst', 'https://v/s'),
			post(1, 'foer', 'Først', 'https://v/f'),
			post(3, 'midt', 'Midt', 'https://v/m')
		];
		const { uger } = byggUger(liste);
		expect(uger[0].poster.map((p) => p.post.lektion.id)).toEqual(['foer', 'midt', 'sen']);
	});
});

describe('seteIUge', () => {
	it('taeller kun dem hun har set', () => {
		const liste = [1, 2, 3].map((d) => post(d, `d${d}`, 'Din 1%', `https://lyd/${d}`));
		const { uger } = byggUger(liste);
		expect(seteIUge(uger[0], new Set(['d1', 'd3']))).toBe(2);
		expect(seteIUge(uger[0], new Set())).toBe(0);
	});
});

describe('byggUger, tomt', () => {
	it('klarer en tom liste', () => {
		expect(byggUger([])).toEqual({ qa: [], uger: [] });
	});

	it('klarer et forloeb der kun er Q&A', () => {
		const { qa, uger } = byggUger([post(3, 'q', 'Q&A')]);
		expect(qa).toHaveLength(1);
		expect(uger).toEqual([]);
	});
});

describe('byggUger, Q&A-dubletter', () => {
	// Et replay ligger tit paa to dage i traek. Det er én udsendelse.
	it('samler samme optagelse paa to dage til én', () => {
		const liste = [
			post(72, 'a', 'Replay Q&A #5', 'https://v/q5'),
			post(73, 'b', 'Replay Q&A #5', 'https://v/q5')
		];
		const { qa } = byggUger(liste);
		expect(qa).toHaveLength(1);
		expect(qa[0].dagNummer).toBe(72);
	});

	it('beholder to forskellige udsendelser med samme titel', () => {
		const liste = [
			post(12, 'a', 'Live Q&A', 'https://v/q1'),
			post(40, 'b', 'Live Q&A', 'https://v/q2')
		];
		expect(byggUger(liste).qa).toHaveLength(2);
	});

	it('sorterer Q&A efter dag', () => {
		const liste = [post(40, 'b', 'Q&A to'), post(12, 'a', 'Q&A en')];
		expect(byggUger(liste).qa.map((p) => p.dagNummer)).toEqual([12, 40]);
	});
});

describe('byggUger, live-links', () => {
	const ZOOM = 'https://zoom.us/j/fast-rum';

	function live(dag: number, id: string, titel: string): ListeLektion {
		const p = post(dag, id, titel, ZOOM);
		p.lektion.format = 'Zoom';
		return p;
	}

	// Linn bruger det samme Zoom-rum hele forloebet igennem.
	it('slaar ikke to moeder i forskellige uger sammen', () => {
		const { qa } = byggUger([live(12, 'a', 'Live Q&A kl. 9'), live(64, 'b', 'Live Q&A kl. 19')]);
		expect(qa).toHaveLength(2);
	});

	it('slaar dem ikke sammen selvom de hedder det samme', () => {
		const { qa } = byggUger([
			live(31, 'a', 'Live Q&A kl. 19-20'),
			live(64, 'b', 'Live Q&A kl. 19-20')
		]);
		expect(qa).toHaveLength(2);
	});

	it('samler ét moede der ligger paa to dage i traek', () => {
		const { qa } = byggUger([
			live(42, 'a', 'Live Q&A fra den 24/6'),
			live(43, 'b', 'Live Q&A fra den 24/6')
		]);
		expect(qa).toHaveLength(1);
		expect(qa[0].dagNummer).toBe(42);
	});

	it('gaelder ogsaa live-links der ikke er Q&A', () => {
		const a = live(10, 'a', 'Fælles træning');
		const b = live(40, 'b', 'Fælles træning');
		const { uger } = byggUger([a, b]);
		expect(uger.flatMap((u) => u.poster)).toHaveLength(2);
	});
});
