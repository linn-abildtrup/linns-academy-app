import { describe, it, expect } from 'vitest';
import {
	springerIOejnene,
	maerkater,
	dagensTal,
	sidsteDage,
	snitPrRegistreretDag,
	initialer,
	fuldtNavn,
	dageSiden,
	navnMedListen,
	soegeTekst,
	STILLE_DAGE,
	type KundeInput
} from './kundeOpslag3';

const alt_ok: KundeInput = {
	harAktivtForlob: true,
	forlobNavn: 'Kickstart August',
	holdHarTraening: true,
	paaNyApp: true,
	harSagtJaTilBeskeder: true,
	ubesvaredeSpoergsmaal: 0,
	dageSidenAktiv: 0,
	aktivitetKendt: true,
	adgangUdloeberOm: null,
	onboardet: true
};

describe('springerIOejnene', () => {
	it('siger INGENTING naar alt er i orden', () => {
		expect(springerIOejnene(alt_ok)).toEqual([]);
	});

	it('SAETTER HOLD UDEN TRAENING OEVERST. Der kommer ingen fejl naar det glemmes', () => {
		const ud = springerIOejnene({ ...alt_ok, holdHarTraening: false, ubesvaredeSpoergsmaal: 3 });
		expect(ud[0].id).toBe('ingen-traening');
		expect(ud[0].alvor).toBe('stop');
	});

	it('naevner ikke manglende traening naar hun slet ikke er paa et forloeb', () => {
		const ud = springerIOejnene({ ...alt_ok, harAktivtForlob: false, holdHarTraening: false });
		expect(ud.some((x) => x.id === 'ingen-traening')).toBe(false);
	});

	it('taeller ubesvarede spoergsmaal i ental og flertal', () => {
		expect(springerIOejnene({ ...alt_ok, ubesvaredeSpoergsmaal: 1 })[0].tekst).toContain(
			'et spørgsmål'
		);
		expect(springerIOejnene({ ...alt_ok, ubesvaredeSpoergsmaal: 4 })[0].tekst).toContain('4 spørgsmål');
	});

	it('siger til om et udloeb, og haardere naar det allerede er sket', () => {
		expect(springerIOejnene({ ...alt_ok, adgangUdloeberOm: 5 })[0].alvor).toBe('se');
		expect(springerIOejnene({ ...alt_ok, adgangUdloeberOm: 0 })[0].alvor).toBe('stop');
	});

	it('naevner ikke et udloeb der ligger langt ude i fremtiden', () => {
		expect(springerIOejnene({ ...alt_ok, adgangUdloeberOm: 200 })).toEqual([]);
	});

	it('skelner mellem aldrig i gang og stille for laenge', () => {
		expect(springerIOejnene({ ...alt_ok, dageSidenAktiv: null })[0].id).toBe('aldrig');
		expect(springerIOejnene({ ...alt_ok, dageSidenAktiv: STILLE_DAGE })[0].id).toBe('stille');
	});

	it('siger ikke noget om et par stille dage', () => {
		expect(springerIOejnene({ ...alt_ok, dageSidenAktiv: 2 })).toEqual([]);
	});

	it('naevner manglende ja til beskeder KUN paa et forloeb', () => {
		expect(
			springerIOejnene({ ...alt_ok, harSagtJaTilBeskeder: false }).some((x) => x.id === 'ingen-noti')
		).toBe(true);
		expect(
			springerIOejnene({
				...alt_ok,
				harAktivtForlob: false,
				harSagtJaTilBeskeder: false
			}).some((x) => x.id === 'ingen-noti')
		).toBe(false);
	});

	it('TIER OM BESKEDER PAA DEN GAMLE APP, hvor de slet ikke findes', () => {
		// Ellers stod alle 315 paa Kickstart August som "kan ikke naas",
		// og et punkt der altid er sandt betyder ingenting.
		expect(
			springerIOejnene({ ...alt_ok, paaNyApp: false, harSagtJaTilBeskeder: false }).some(
				(x) => x.id === 'ingen-noti'
			)
		).toBe(false);
	});

	it('naevner manglende opstart KUN for dem der er paa den nye app', () => {
		expect(
			springerIOejnene({ ...alt_ok, onboardet: false }).some((x) => x.id === 'ikke-onboardet')
		).toBe(true);
		expect(
			springerIOejnene({ ...alt_ok, paaNyApp: false, onboardet: false }).some(
				(x) => x.id === 'ikke-onboardet'
			)
		).toBe(false);
	});

	it('SIGER IKKE ALDRIG NAAR VI IKKE FIK LOV AT SE EFTER', () => {
		// Randi, 4. september: der stod at hun aldrig havde registreret
		// noget, mens hun havde tastet hele ugen. Opslaget blev afvist.
		const ud = springerIOejnene({ ...alt_ok, aktivitetKendt: false, dageSidenAktiv: null });
		expect(ud.some((x) => x.id === 'aldrig')).toBe(false);
		expect(ud.some((x) => x.id === 'stille')).toBe(false);
		expect(ud[0].id).toBe('ukendt-aktivitet');
	});

	it('siger heller ikke stille naar vi ikke ved noget', () => {
		const ud = springerIOejnene({ ...alt_ok, aktivitetKendt: false, dageSidenAktiv: 40 });
		expect(ud.some((x) => x.id === 'stille')).toBe(false);
	});

	it('siger HVAD der kan goeres ved hvert punkt', () => {
		for (const p of springerIOejnene({ ...alt_ok, holdHarTraening: false, dageSidenAktiv: null })) {
			expect(p.hvad.length).toBeGreaterThan(0);
		}
	});
});

describe('maerkater', () => {
	it('giver fire naar der mangler traening, ellers tre', () => {
		expect(maerkater(alt_ok)).toHaveLength(3);
		expect(maerkater({ ...alt_ok, holdHarTraening: false })).toHaveLength(4);
	});

	it('skriver forloebets navn naar hun er paa et', () => {
		expect(maerkater(alt_ok)[0].tekst).toBe('Kickstart August');
	});

	it('siger tydeligt fra naar hun ikke er paa et forloeb', () => {
		expect(maerkater({ ...alt_ok, harAktivtForlob: false })[0].tekst).toContain('Intet aktivt');
	});

	it('skriver i dag og i går i stedet for nul og ét', () => {
		expect(maerkater({ ...alt_ok, dageSidenAktiv: 0 })[1].tekst).toBe('Aktiv i dag');
		expect(maerkater({ ...alt_ok, dageSidenAktiv: 1 })[1].tekst).toBe('Aktiv i går');
	});

	it('skriver ukendt i stedet for at gaette paa maerkaten', () => {
		expect(maerkater({ ...alt_ok, aktivitetKendt: false })[1].tekst).toBe('Aktivitet ukendt');
	});

	it('markerer det naar der er gaaet for laenge', () => {
		expect(maerkater({ ...alt_ok, dageSidenAktiv: 20 })[1].alvor).toBe('se');
		expect(maerkater({ ...alt_ok, dageSidenAktiv: 2 })[1].alvor).toBe('ok');
	});
});

describe('dagensTal', () => {
	it('laegger dagens maaltider sammen', () => {
		const k = dagensTal(
			[
				{ dato: '2026-09-01', totalP: 25, totalF: 8 },
				{ dato: '2026-09-01', totalP: 17, totalF: 6 }
			],
			90
		);
		expect(k.get('2026-09-01')?.protein).toBe(42);
		expect(k.get('2026-09-01')?.fiber).toBe(14);
	});

	it('markerer en dag hvor maalet blev ramt', () => {
		const k = dagensTal([{ dato: '2026-09-01', totalP: 95 }], 90);
		expect(k.get('2026-09-01')?.ramteMaal).toBe(true);
	});

	it('GIVER INGEN RAEKKE for en dag uden registrering', () => {
		// En dag uden noget er ikke nul, den er en dag vi ikke ved noget om.
		const k = dagensTal([{ dato: '2026-09-01', totalP: 40 }], 90);
		expect(k.has('2026-09-02')).toBe(false);
	});

	it('klarer en linje uden tal', () => {
		const k = dagensTal([{ dato: '2026-09-01' }], 90);
		expect(k.get('2026-09-01')?.protein).toBe(0);
	});
});

describe('sidsteDage', () => {
	it('giver dagene i raekkefoelge med i dag sidst', () => {
		const nu = new Date('2026-09-03T12:00:00Z').getTime();
		const d = sidsteDage(3, nu);
		expect(d).toHaveLength(3);
		expect(d[2]).toBe('2026-09-03');
		expect(d[0]).toBe('2026-09-01');
	});
});

describe('snitPrRegistreretDag', () => {
	it('DELER MED DE DAGE HUN HAR TASTET, ikke med alle dage', () => {
		// Linns regel: en status maa aldrig laese som en anklage.
		const s = snitPrRegistreretDag([
			{ dato: 'a', protein: 60, fiber: 20, ramteMaal: false },
			{ dato: 'b', protein: 80, fiber: 30, ramteMaal: false }
		]);
		expect(s.protein).toBe(70);
		expect(s.antal).toBe(2);
	});

	it('klarer at der ikke er nogen dage', () => {
		expect(snitPrRegistreretDag([]).antal).toBe(0);
	});
});

describe('navnMedListen', () => {
	it('lader kontoens eget navn staa naar det er helt', () => {
		expect(navnMedListen('Mette', 'Hansen', 'Anden Person')).toEqual({
			fornavn: 'Mette',
			efternavn: 'Hansen'
		});
	});

	it('HENTER EFTERNAVNET I KOEBSLISTEN. To tredjedele mangler det paa kontoen', () => {
		expect(navnMedListen('Camilla', '', 'Camilla Stemann')).toEqual({
			fornavn: 'Camilla',
			efternavn: 'Stemann'
		});
	});

	it('beholder kontoens fornavn ogsaa naar listen siger noget andet', () => {
		expect(navnMedListen('Mette', '', 'Grethe Hansen').fornavn).toBe('Mette');
		expect(navnMedListen('Mette', '', 'Grethe Hansen').efternavn).toBe('Hansen');
	});

	it('tager hele navnet fra listen naar kontoen er tom', () => {
		expect(navnMedListen('', '', 'Anne Sofie Møller Bak')).toEqual({
			fornavn: 'Anne',
			efternavn: 'Sofie Møller Bak'
		});
	});

	it('finder ikke paa noget naar listen kun har ét ord', () => {
		expect(navnMedListen('Heidi', '', 'Heidi')).toEqual({ fornavn: 'Heidi', efternavn: '' });
	});

	it('klarer at der slet ikke er noget i listen', () => {
		expect(navnMedListen('Heidi', '', undefined)).toEqual({ fornavn: 'Heidi', efternavn: '' });
	});
});

describe('soegeTekst', () => {
	it('leder i baade kontoens navn, listens navn og mailen', () => {
		const t = soegeTekst('Camilla', '', 'camilla@x.dk', 'Camilla Stemann');
		expect(t).toContain('Stemann');
		expect(t).toContain('camilla@x.dk');
	});

	it('springer det tomme over i stedet for at lave dobbelte mellemrum', () => {
		expect(soegeTekst('Mette', '', 'm@e.dk', undefined)).toBe('Mette m@e.dk');
	});
});

describe('navn og initialer', () => {
	it('tager de to forbogstaver', () => {
		expect(initialer('Mette', 'Hansen', 'm@e.dk')).toBe('MH');
	});

	it('falder tilbage paa mailen naar der ikke er et navn', () => {
		expect(initialer('', '', 'mette@e.dk')).toBe('ME');
	});

	it('samler navnet, og bruger mailen naar der ikke er et', () => {
		expect(fuldtNavn('Mette', 'Hansen', 'm@e.dk')).toBe('Mette Hansen');
		expect(fuldtNavn('', '', 'm@e.dk')).toBe('m@e.dk');
		expect(fuldtNavn('', '', '')).toBe('(uden navn)');
	});
});

describe('dageSiden', () => {
	const nu = new Date('2026-09-03T12:00:00Z').getTime();

	it('regner dage siden et tidspunkt', () => {
		expect(dageSiden(nu, nu)).toBe(0);
		expect(dageSiden(nu - 3 * 86400000, nu)).toBe(3);
	});

	it('giver null naar der ikke er noget tidspunkt', () => {
		expect(dageSiden(null, nu)).toBeNull();
		expect(dageSiden(0, nu)).toBeNull();
	});

	it('giver aldrig et negativt tal', () => {
		expect(dageSiden(nu + 86400000, nu)).toBe(0);
	});
});
