import { describe, it, expect } from 'vitest';
import {
	detectSeparator,
	parseCsvLine,
	capitalizeName,
	splitFullName,
	parseSimpleroCsv,
	dageSidenStart,
	unlockedDays,
	dagDato,
	produktTypeForForlob,
	forlobSlutMs,
	bibliotekBonusSlutMs
} from './forlobAdgang';
import { KICKSTART_PRODUCT_ID, KROPSRO_PRODUCT_ID } from '../types';

const MS_PER_DAG = 24 * 60 * 60 * 1000;

describe('detectSeparator', () => {
	it('detekterer tab som separator', () => {
		expect(detectSeparator('Email\tFirst Name\tLast Name')).toBe('\t');
	});

	it('detekterer semikolon som separator', () => {
		expect(detectSeparator('Email;First Name;Last Name')).toBe(';');
	});

	it('detekterer komma som default', () => {
		expect(detectSeparator('Email,First Name,Last Name')).toBe(',');
	});

	it('falder tilbage til komma når intet matches', () => {
		expect(detectSeparator('EmailFirstNameLastName')).toBe(',');
	});

	it('vælger den dominerende separator når flere typer findes', () => {
		expect(detectSeparator('a,b,c\td')).toBe(',');
	});
});

describe('parseCsvLine', () => {
	it('parser simpel komma-linje', () => {
		expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
	});

	it('respekterer citationstegn omkring felter', () => {
		expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
	});

	it('håndterer escaped quotes inde i quoted field', () => {
		expect(parseCsvLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
	});

	it('returnerer tomme felter ved efterfølgende separator', () => {
		expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
	});

	it('bruger custom separator', () => {
		expect(parseCsvLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
	});
});

describe('capitalizeName', () => {
	it('sætter første bogstav stort', () => {
		expect(capitalizeName('maria')).toBe('Maria');
	});

	it('lower-caser resten', () => {
		expect(capitalizeName('MARIA')).toBe('Maria');
	});

	it('håndterer flere ord', () => {
		expect(capitalizeName('maria sofie')).toBe('Maria Sofie');
	});

	it('returnerer tom streng for tomt input', () => {
		expect(capitalizeName('')).toBe('');
		expect(capitalizeName('   ')).toBe('');
	});
});

describe('splitFullName', () => {
	it('splitter to-ords navn i fornavn og efternavn', () => {
		expect(splitFullName('Maria Sofie')).toEqual({ firstName: 'Maria', lastName: 'Sofie' });
	});

	it('returnerer kun fornavn ved enkelt ord', () => {
		expect(splitFullName('Maria')).toEqual({ firstName: 'Maria', lastName: '' });
	});

	it('samler flere ord til efternavnet', () => {
		expect(splitFullName('Maria von Trier')).toEqual({
			firstName: 'Maria',
			lastName: 'Von Trier'
		});
	});

	it('returnerer tomt for tom input', () => {
		expect(splitFullName('')).toEqual({ firstName: '', lastName: '' });
	});
});

describe('parseSimpleroCsv', () => {
	it('parser standard komma-CSV med separate first/last name kolonner', () => {
		const csv = 'Email,First Name,Last Name\nmaria@test.dk,Maria,Olsen\nanne@test.dk,Anne,Larsen';
		const r = parseSimpleroCsv(csv);
		expect(r.fejl).toBeNull();
		expect(r.rows).toHaveLength(2);
		expect(r.rows[0]).toEqual({ email: 'maria@test.dk', firstName: 'Maria', lastName: 'Olsen' });
	});

	it('falder tilbage til Name-kolonnen hvis First/Last mangler', () => {
		const csv = 'Email,Name\nmaria@test.dk,Maria Olsen';
		const r = parseSimpleroCsv(csv);
		expect(r.rows[0]).toEqual({ email: 'maria@test.dk', firstName: 'Maria', lastName: 'Olsen' });
	});

	it('springer rækker over med Canceled at udfyldt', () => {
		const csv = 'Email,Canceled at\nmaria@test.dk,\nsofie@test.dk,2026-01-15';
		const r = parseSimpleroCsv(csv);
		expect(r.rows).toHaveLength(1);
		expect(r.rows[0].email).toBe('maria@test.dk');
		expect(r.skippedCanceled).toBe(1);
	});

	it('springer ugyldige email-rækker over', () => {
		const csv = 'Email\nmaria@test.dk\nikke-en-email\nanne@test.dk';
		const r = parseSimpleroCsv(csv);
		expect(r.rows).toHaveLength(2);
		expect(r.skippedInvalid).toBe(1);
	});

	it('lower-caser email-adresser', () => {
		const csv = 'Email\nMARIA@test.dk';
		const r = parseSimpleroCsv(csv);
		expect(r.rows[0].email).toBe('maria@test.dk');
	});

	it('håndterer tab-separeret format fra Simplero copy-paste', () => {
		const csv = 'Email\tFirst Name\tLast Name\nmaria@test.dk\tMaria\tOlsen';
		const r = parseSimpleroCsv(csv);
		expect(r.fejl).toBeNull();
		expect(r.rows[0]).toEqual({ email: 'maria@test.dk', firstName: 'Maria', lastName: 'Olsen' });
	});

	it('returnerer fejl hvis Email-kolonne mangler', () => {
		const csv = 'Name,Phone\nMaria,12345678';
		const r = parseSimpleroCsv(csv);
		expect(r.fejl).toContain('Email');
		expect(r.rows).toHaveLength(0);
	});

	it('returnerer fejl ved tomt input', () => {
		expect(parseSimpleroCsv('').fejl).toContain('tomt');
	});

	it('returnerer fejl hvis kun header findes', () => {
		expect(parseSimpleroCsv('Email\n').fejl).toContain('mindst');
	});

	it('fjerner BOM fra første linje', () => {
		const csv = '﻿Email\nmaria@test.dk';
		const r = parseSimpleroCsv(csv);
		expect(r.fejl).toBeNull();
		expect(r.rows).toHaveLength(1);
	});
});

describe('dageSidenStart', () => {
	it('returnerer 0 på selve startdagen', () => {
		const start = new Date('2026-05-01T12:00:00');
		const idag = new Date('2026-05-01T18:00:00');
		expect(dageSidenStart(start, idag)).toBe(0);
	});

	it('returnerer 1 dagen efter start', () => {
		const start = new Date('2026-05-01T12:00:00');
		const idag = new Date('2026-05-02T08:00:00');
		expect(dageSidenStart(start, idag)).toBe(1);
	});

	it('returnerer -1 dagen før start', () => {
		const start = new Date('2026-05-02T12:00:00');
		const idag = new Date('2026-05-01T18:00:00');
		expect(dageSidenStart(start, idag)).toBe(-1);
	});

	it('returnerer 21 efter et 21-dages forløb', () => {
		const start = new Date('2026-05-01T12:00:00');
		const idag = new Date('2026-05-22T12:00:00');
		expect(dageSidenStart(start, idag)).toBe(21);
	});
});

describe('unlockedDays', () => {
	it('returnerer -1 hvis startDato er null', () => {
		expect(unlockedDays(null, 21)).toBe(-1);
	});

	it('returnerer -1 hvis forløbet ikke er startet', () => {
		const start = new Date('2026-05-02T12:00:00');
		const idag = new Date('2026-05-01T12:00:00');
		expect(unlockedDays(start, 21, idag)).toBe(-1);
	});

	it('returnerer 0 på startdagen', () => {
		const start = new Date('2026-05-01T12:00:00');
		const idag = new Date('2026-05-01T12:00:00');
		expect(unlockedDays(start, 21, idag)).toBe(0);
	});

	it('returnerer aktuelt antal dage hvis under antalDage', () => {
		const start = new Date('2026-05-01T12:00:00');
		const idag = new Date('2026-05-08T12:00:00');
		expect(unlockedDays(start, 21, idag)).toBe(7);
	});

	it('cappes på antalDage selv hvis flere dage er gået', () => {
		const start = new Date('2026-05-01T12:00:00');
		const idag = new Date('2026-06-01T12:00:00');
		expect(unlockedDays(start, 21, idag)).toBe(21);
	});
});

describe('dagDato', () => {
	it('dag 0 er startdatoen', () => {
		const start = new Date('2026-05-01T12:00:00');
		expect(dagDato(start, 0).toDateString()).toBe(start.toDateString());
	});

	it('dag 7 er en uge efter startdatoen', () => {
		const start = new Date('2026-05-01T12:00:00');
		expect(dagDato(start, 7).toDateString()).toBe(new Date('2026-05-08T12:00:00').toDateString());
	});

	it('returnerer en ny Date — muterer ikke startdatoen', () => {
		const start = new Date('2026-05-01T12:00:00');
		const oprindelig = start.getTime();
		dagDato(start, 5);
		expect(start.getTime()).toBe(oprindelig);
	});
});

describe('produktTypeForForlob', () => {
	it('Kropsro-forloeb (uden adgangsNiveau) -> premiumforloeb', () => {
		expect(produktTypeForForlob({ type: 'kropsro' })).toBe(KROPSRO_PRODUCT_ID);
	});

	it('Kickstart-forloeb (uden adgangsNiveau) -> kickstart', () => {
		expect(produktTypeForForlob({ type: 'kickstart' })).toBe(KICKSTART_PRODUCT_ID);
	});

	it('Kickstart-forloeb med adgangsNiveau=premium -> premiumforloeb (juni-flow)', () => {
		expect(produktTypeForForlob({ type: 'kickstart', adgangsNiveau: 'premium' })).toBe(
			KROPSRO_PRODUCT_ID
		);
	});

	it('Kropsro-forloeb med adgangsNiveau=basis -> kickstart (hypotetisk basis-Kropsro)', () => {
		expect(produktTypeForForlob({ type: 'kropsro', adgangsNiveau: 'basis' })).toBe(
			KICKSTART_PRODUCT_ID
		);
	});

	it('Kickstart med adgangsNiveau=basis -> kickstart', () => {
		expect(produktTypeForForlob({ type: 'kickstart', adgangsNiveau: 'basis' })).toBe(
			KICKSTART_PRODUCT_ID
		);
	});

	it('Kropsro med adgangsNiveau=premium -> premiumforloeb (eksplicit)', () => {
		expect(produktTypeForForlob({ type: 'kropsro', adgangsNiveau: 'premium' })).toBe(
			KROPSRO_PRODUCT_ID
		);
	});

	it('forloeb uden type defaulter til kickstart-adfaerd', () => {
		expect(produktTypeForForlob({})).toBe(KICKSTART_PRODUCT_ID);
	});

	it('tom adgangsNiveau-felt opfoerer sig som udeladt', () => {
		expect(produktTypeForForlob({ type: 'kropsro', adgangsNiveau: undefined })).toBe(
			KROPSRO_PRODUCT_ID
		);
	});
});

describe('forlobSlutMs', () => {
	const start = new Date('2026-06-01T00:00:00Z').getTime();

	it('returnerer 0 hvis startMs mangler', () => {
		expect(forlobSlutMs(0, 21)).toBe(0);
	});

	it('returnerer 0 hvis antalDage mangler', () => {
		expect(forlobSlutMs(start, 0)).toBe(0);
	});

	it('returnerer 0 ved negative vaerdier', () => {
		expect(forlobSlutMs(-1, 21)).toBe(0);
		expect(forlobSlutMs(start, -5)).toBe(0);
	});

	it('Kickstart (21 dage): slut = start + 22 dage (hele sidste dag med)', () => {
		expect(forlobSlutMs(start, 21)).toBe(start + 22 * MS_PER_DAG);
	});

	it('Kropsro (84 dage): slut = start + 85 dage', () => {
		expect(forlobSlutMs(start, 84)).toBe(start + 85 * MS_PER_DAG);
	});
});

describe('bibliotekBonusSlutMs', () => {
	const start = new Date('2026-06-01T00:00:00Z').getTime();

	it('returnerer 0 hvis forloebets slut ikke kan beregnes', () => {
		expect(bibliotekBonusSlutMs(0, 21)).toBe(0);
		expect(bibliotekBonusSlutMs(start, 0)).toBe(0);
	});

	it('= forloebets slut + 90 dage', () => {
		const slut = forlobSlutMs(start, 21);
		expect(bibliotekBonusSlutMs(start, 21)).toBe(slut + 90 * MS_PER_DAG);
	});

	it('Kickstart (21 dage): start + 22 + 90 = start + 112 dage', () => {
		expect(bibliotekBonusSlutMs(start, 21)).toBe(start + 112 * MS_PER_DAG);
	});
});

describe('produktTypeForForlob', () => {
	it('Kropsro-type -> premiumforløb-spor', () => {
		expect(produktTypeForForlob({ type: 'kropsro' })).toBe(KROPSRO_PRODUCT_ID);
	});

	it('Kickstart-type (eller udeladt) -> kickstart-spor', () => {
		expect(produktTypeForForlob({ type: 'kickstart' })).toBe(KICKSTART_PRODUCT_ID);
		expect(produktTypeForForlob({})).toBe(KICKSTART_PRODUCT_ID);
	});

	it('adgangsNiveau=premium override -> premiumforløb-spor', () => {
		expect(produktTypeForForlob({ type: 'kickstart', adgangsNiveau: 'premium' })).toBe(
			KROPSRO_PRODUCT_ID
		);
	});

	it('bygget forløb -> eget data-spor (produktNoegle)', () => {
		expect(produktTypeForForlob({ byggetForlob: true, produktNoegle: 'sommer_reset_2026' })).toBe(
			'sommer_reset_2026'
		);
	});

	it('bygget forløb falder tilbage til type-regel hvis produktNoegle mangler', () => {
		expect(produktTypeForForlob({ byggetForlob: true })).toBe(KICKSTART_PRODUCT_ID);
	});
});
