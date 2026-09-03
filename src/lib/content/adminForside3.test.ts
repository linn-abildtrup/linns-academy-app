import { describe, it, expect } from 'vitest';
import {
	VAERKTOEJER,
	OMRAADE_NAVN,
	byggStatus,
	iOmraade,
	oftestBrugte,
	soegVaerktoej,
	hilsen,
	type StatusInput
} from './adminForside3';

const tomt: StatusInput = { ubesvarede: 0, aeldsteSpoergsmaalDage: null };

describe('VAERKTOEJER', () => {
	it('har alle vaerktoejer fra begge apper', () => {
		expect(VAERKTOEJER.length).toBeGreaterThanOrEqual(30);
	});

	it('har ingen dublet-ruter', () => {
		const ruter = VAERKTOEJER.map((v) => v.rute);
		expect(new Set(ruter).size).toBe(ruter.length);
	});

	it('har et omraade paa hver, og de findes alle sammen', () => {
		for (const v of VAERKTOEJER) {
			expect(OMRAADE_NAVN[v.omraade]).toBeTruthy();
			expect(v.omraade).not.toBe('forside');
		}
	});

	it('har baade navn, undertekst og rute paa hver', () => {
		for (const v of VAERKTOEJER) {
			expect(v.navn.length).toBeGreaterThan(0);
			expect(v.under.length).toBeGreaterThan(0);
			expect(v.rute.startsWith('/')).toBe(true);
		}
	});

	it('daekker BEGGE apper, saa det er én admin og ikke to', () => {
		expect(VAERKTOEJER.some((v) => v.rute.startsWith('/app/'))).toBe(true);
		expect(VAERKTOEJER.some((v) => v.rute.startsWith('/ny/'))).toBe(true);
	});

	it('markerer de gamle app-sider som gamle, saa noten passer', () => {
		for (const v of VAERKTOEJER) {
			if (v.rute.startsWith('/app/')) expect(v.gammel).toBe(true);
			else expect(v.gammel).toBeUndefined();
		}
	});
});

describe('iOmraade og oftestBrugte', () => {
	it('deler dem op uden at tabe nogen', () => {
		const omraader = ['kunder', 'forlob', 'mad', 'traening', 'beskeder', 'system'] as const;
		const talt = omraader.reduce((s, o) => s + iOmraade(o).length, 0);
		expect(talt).toBe(VAERKTOEJER.length);
	});

	it('har mindst ét vaerktoej i hvert omraade', () => {
		for (const o of ['kunder', 'forlob', 'mad', 'traening', 'beskeder', 'system'] as const) {
			expect(iOmraade(o).length).toBeGreaterThan(0);
		}
	});

	it('har kunder og beskeder blandt de oftest brugte. Linns valg', () => {
		const o = oftestBrugte();
		expect(o.some((v) => v.omraade === 'kunder')).toBe(true);
		expect(o.some((v) => v.omraade === 'beskeder')).toBe(true);
	});

	it('holder de oftest brugte paa et antal der kan overskues', () => {
		expect(oftestBrugte().length).toBeLessThanOrEqual(8);
	});
});

describe('byggStatus', () => {
	it('giver ÉT tal. De tre andre blev fjernet 3. september', () => {
		expect(byggStatus(tomt)).toHaveLength(1);
		expect(byggStatus(tomt)[0].id).toBe('spoergsmaal');
	});

	it('FREMHAEVER KUN naar der faktisk venter noget', () => {
		expect(byggStatus(tomt)[0].vigtig).toBe(false);
		expect(byggStatus({ ...tomt, ubesvarede: 3 })[0].vigtig).toBe(true);
	});

	it('siger noget beroligende naar der ikke er noget', () => {
		expect(byggStatus(tomt)[0].under).toContain('ingen venter');
	});

	it('BEHOLDER null mens tallet hentes, og laver det ikke om til nul', () => {
		// Nul betyder at der ikke er noget at se til. Det er en helt anden
		// besked end at vi ikke ved det endnu.
		const s = byggStatus({ ...tomt, ubesvarede: null });
		expect(s[0].vaerdi).toBeNull();
		expect(s[0].vigtig).toBe(false);
	});

	it('skriver dag i ental og dage i flertal', () => {
		expect(byggStatus({ ...tomt, ubesvarede: 1, aeldsteSpoergsmaalDage: 1 })[0].under).toContain(
			'1 dag gammelt'
		);
		expect(byggStatus({ ...tomt, ubesvarede: 2, aeldsteSpoergsmaalDage: 4 })[0].under).toContain(
			'4 dage gammelt'
		);
	});

	it('peger hen hvor det kan ordnes', () => {
		expect(byggStatus(tomt)[0].rute.startsWith('/')).toBe(true);
	});
});

describe('soegVaerktoej', () => {
	it('finder paa navnet', () => {
		expect(soegVaerktoej('opskrifter').length).toBeGreaterThan(0);
	});

	it('finder ogsaa paa hvad vaerktoejet GOER', () => {
		// Linn husker tit hvad noget goer og ikke hvad det hedder.
		const ud = soegVaerktoej('adgangskode');
		expect(ud.some((v) => v.navn === 'Nulstil adgangskode')).toBe(true);
	});

	it('kan soeges uden danske bogstaver', () => {
		expect(soegVaerktoej('spoergsmaal').length).toBeGreaterThan(0);
		expect(soegVaerktoej('traening').length).toBeGreaterThan(0);
	});

	it('flere ord skal alle findes', () => {
		expect(soegVaerktoej('billeder opskrifter').length).toBeGreaterThan(0);
		expect(soegVaerktoej('billeder kettlebell').length).toBe(0);
	});

	it('giver ingenting paa en tom soegning, saa listen ikke bare vises igen', () => {
		expect(soegVaerktoej('')).toEqual([]);
		expect(soegVaerktoej('   ')).toEqual([]);
	});
});

describe('hilsen', () => {
	it('foelger klokken, for Linn arbejder ofte om aftenen', () => {
		expect(hilsen(8)).toContain('Godmorgen');
		expect(hilsen(13)).toContain('Goddag');
		expect(hilsen(21)).toContain('Godaften');
	});
});
