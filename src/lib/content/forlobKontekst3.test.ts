import { describe, it, expect } from 'vitest';
import {
	datoTekst,
	soegeOrd,
	vaelgFaq,
	byggForlobKontekst,
	type FaqPunkt,
	type ForlobViden
} from './forlobKontekst3';

const qa: FaqPunkt = {
	spoergsmaal: 'Hvornår mødes vi til Q&A-live, og hvor?',
	svar: 'Vi mødes på Zoom onsdag den 2/9 kl. 19-20.',
	kategori: 'Om Q&A-live og spørgsmål'
};
const frugt: FaqPunkt = {
	spoergsmaal: 'Må jeg gerne spise frugt?',
	svar: 'Ja, meget gerne. Frugt er faktisk vigtig.',
	kategori: 'Om kost og måltider'
};
const kettlebell: FaqPunkt = {
	spoergsmaal: 'Skal jeg købe en kettlebell?',
	svar: 'Nej, du behøver ikke købe en kettlebell.',
	kategori: 'Om bevægelse og træning'
};

const viden: ForlobViden = {
	forlobNavn: 'Kickstart August 2026',
	dagNummer: 4,
	antalDage: 21,
	iDag: '2026-09-01',
	faq: [frugt, qa, kettlebell]
};

describe('datoTekst', () => {
	it('skriver dagen ud paa dansk, saa AI en kan regne fra en rigtig dag', () => {
		expect(datoTekst('2026-09-01')).toBe('tirsdag den 1. september 2026');
	});

	it('giver ikke en tom streng paa noget uforstaaeligt', () => {
		expect(datoTekst('ikke-en-dato')).toBe('ikke-en-dato');
	});
});

describe('soegeOrd', () => {
	it('beholder Q&A som ét ord', () => {
		expect(soegeOrd('Hvornår er der Q&A?')).toContain('q&a');
	});

	it('smider fyldord vaek, saa de ikke afgoer hvilket svar hun faar', () => {
		expect(soegeOrd('Hvornår er der Q&A?')).not.toContain('der');
	});

	it('beholder det ord der betyder noget', () => {
		expect(soegeOrd('Hvornår er der Q&A?')).toContain('hvornår');
	});
});

describe('vaelgFaq', () => {
	it('LAENGDE MAA IKKE VINDE OVER RELEVANS. Maalt paa de rigtige data 1. september', () => {
		// Da AI en foerst blev bygget, vandt det her lange svar over selve
		// Q&A-svaret, fordi ordet "der" stod fyrre gange i det. Kunden fik
		// derfor ikke tidspunktet at vide. Testen holder paa rettelsen.
		const langt: FaqPunkt = {
			spoergsmaal: 'Jeg kan slet ikke spise så meget mad',
			svar: 'Der er meget der kan siges om det der. '.repeat(40),
			kategori: 'Om kost og måltider'
		};
		const ud = vaelgFaq([langt, qa], 'Hvornår er der Q&A?');
		expect(ud[0].spoergsmaal).toContain('Q&A');
	});

	it('laegger det mest relevante foerst', () => {
		const ud = vaelgFaq(viden.faq, 'hvornår er der Q&A?');
		expect(ud[0].spoergsmaal).toContain('Q&A');
	});

	it('rammer ogsaa naar hun skriver skaevt af Linns ord', () => {
		const ud = vaelgFaq(viden.faq, 'skal jeg have en kettlebell');
		expect(ud[0].spoergsmaal).toContain('kettlebell');
	});

	it('tager de OEVRIGE med naar der er plads, for hun spoerger tit skaevt', () => {
		expect(vaelgFaq(viden.faq, 'hvornår er der Q&A?')).toHaveLength(3);
	});

	it('holder sig inden for pladsen', () => {
		const mange: FaqPunkt[] = Array.from({ length: 60 }, (_, i) => ({
			spoergsmaal: `Spørgsmål ${i}`,
			svar: 'x'.repeat(400)
		}));
		const ud = vaelgFaq(mange, 'noget', 2000);
		expect(ud.length).toBeGreaterThan(0);
		expect(ud.length).toBeLessThan(60);
	});

	it('beholder raekkefoelgen naar der ikke er noget at gaa efter', () => {
		expect(vaelgFaq(viden.faq, '')).toEqual([frugt, qa, kettlebell]);
	});

	it('klarer en tom FAQ', () => {
		expect(vaelgFaq([], 'hvornår er der Q&A?')).toEqual([]);
	});
});

describe('byggForlobKontekst med lektioner', () => {
	const medLektioner: ForlobViden = {
		...viden,
		lektioner: [
			{ dag: 1, titel: 'Dag 1, Protein til morgenmad' },
			{ dag: 3, titel: 'Dag 3, Cravings', beskrivelse: 'Om trang til sødt' }
		]
	};

	it('tager lektionerne med', () => {
		const t = byggForlobKontekst(medLektioner, 'hvad har jeg set');
		expect(t).toContain('Dag 1, Protein til morgenmad');
		expect(t).toContain('Om trang til sødt');
	});

	it('sorterer dem efter dag', () => {
		const t = byggForlobKontekst(
			{ ...medLektioner, lektioner: [{ dag: 3, titel: 'Sent' }, { dag: 1, titel: 'Tidligt' }] },
			'noget'
		);
		expect(t.indexOf('Tidligt')).toBeLessThan(t.indexOf('Sent'));
	});

	it('siger at den ikke maa finde paa hvad der kommer senere', () => {
		const t = byggForlobKontekst(medLektioner, 'noget');
		expect(t).toContain('kommer senere i forløbet');
	});

	it('naevner ikke afsnittet naar der ingen lektioner er', () => {
		expect(byggForlobKontekst(viden, 'noget')).not.toContain('DET HUN HAR I APPEN INDTIL NU');
	});
});

describe('byggForlobKontekst', () => {
	const tekst = byggForlobKontekst(viden, 'hvornår er der Q&A?');

	it('siger hvilken dag det er i dag', () => {
		expect(tekst).toContain('tirsdag den 1. september 2026');
	});

	it('siger hvilket forloeb hun er paa og hvilken dag hun er naaet til', () => {
		expect(tekst).toContain('Kickstart August 2026');
		expect(tekst).toContain('dag 4 ud af 21');
	});

	it('tager selve Q&A-svaret med, altsaa det hun spurgte om', () => {
		expect(tekst).toContain('onsdag den 2/9 kl. 19-20');
	});

	it('FORBYDER at finde et tidspunkt paa. Den linje skal blive staaende', () => {
		expect(tekst).toContain('Find aldrig et tidspunkt på');
	});

	it('beder den tilbyde at sende videre til Linn naar svaret ikke er der', () => {
		expect(tekst).toContain('sende spørgsmålet videre til Linn');
	});

	it('siger det tydeligt naar hun ikke er paa et forloeb', () => {
		const t = byggForlobKontekst({ ...viden, forlobNavn: '', faq: [] }, 'hvornår er der Q&A?');
		expect(t).toContain('IKKE PÅ ET FORLØB');
		expect(t).not.toContain('dag 4 ud af');
	});

	it('naevner ikke FAQ-afsnittet naar der ingen FAQ er', () => {
		const t = byggForlobKontekst({ ...viden, faq: [] }, 'noget');
		expect(t).not.toContain('SPØRGSMÅL OG SVAR FRA HENDES EGET FORLØB');
	});

	it('har reglerne til SIDST, saa de ikke drukner i 25 svar', () => {
		const iRegler = tekst.indexOf('REGLER FOR DET HER AFSNIT');
		const iSvar = tekst.indexOf('onsdag den 2/9');
		expect(iRegler).toBeGreaterThan(iSvar);
	});
});
