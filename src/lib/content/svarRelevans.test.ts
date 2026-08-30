import { describe, it, expect } from 'vitest';
import { ordstammer, vaelgRelevanteSvar, type KorpusSvar } from './svarRelevans';

function svar(
	id: string,
	spoergsmaal: string,
	tekst: string,
	forlobId = 'kickstart_juni_2026',
	tidsstempel = 1000
): KorpusSvar {
	return { id, spoergsmaal, svar: tekst, forlobId, tidsstempel };
}

const KORPUS: KorpusSvar[] = [
	svar(
		'a',
		'Jeg har været meget forstoppet siden jeg startede, hvad gør jeg?',
		'Forstoppelse er almindeligt i starten. Drik mere vand og få fibre fra grøntsager.'
	),
	svar(
		'b',
		'Må jeg drikke kaffe om morgenen?',
		'Ja, en enkelt kop kaffe er helt fint. Bare ikke på tom mave.'
	),
	svar(
		'c',
		'Hvor meget protein skal jeg have om dagen?',
		'Sigt efter 90 gram protein fordelt på dine måltider.'
	),
	svar(
		'd',
		'Jeg sover dårligt og er træt hele dagen',
		'Træthed hænger tit sammen med for lidt mad tidligt på dagen.'
	),
	svar(
		'e',
		'Min mave er hård og jeg har ikke haft afføring i tre dage',
		'Hård mave og manglende afføring skyldes ofte for lidt væske. Prøv et glas vand ekstra.',
		'kropsro_maj_2026',
		2000
	)
];

describe('ordstammer', () => {
	it('fjerner fyldord og korte ord', () => {
		expect(ordstammer('Jeg vil gerne om det er ok')).toEqual([]);
		expect(ordstammer('Jeg spiser gerne fisk')).toEqual(['spis', 'fisk']);
	});

	it('slår ental og flertal sammen', () => {
		expect(ordstammer('måltider')).toEqual(ordstammer('måltid'));
		expect(ordstammer('grøntsagerne')).toEqual(ordstammer('grøntsag'));
	});

	it('tåler æ, ø og å', () => {
		expect(ordstammer('træthed')).toContain('træthed');
	});
});

// Proeve-arkivet her er paa fem svar. I saa lille et arkiv er intet ord
// sjaeldent, saa scorerne er lave og standard-graensen ville sortere alt fra.
// Derfor saettes minScore lavt i proeverne. Mod det rigtige arkiv paa flere
// hundrede svar ligger et aegte match typisk mellem 10 og 25.
const LILLE_ARKIV = { minScore: 1 };

describe('vaelgRelevanteSvar', () => {
	it('finder svaret om det samme emne', () => {
		const valgt = vaelgRelevanteSvar(KORPUS, 'Jeg er blevet forstoppet, hvad gør jeg?', {
			...LILLE_ARKIV,
			maks: 3
		});
		expect(valgt[0].id).toBe('a');
	});

	it('henter på tværs af forløb når emnet passer bedst der', () => {
		const valgt = vaelgRelevanteSvar(KORPUS, 'Kan jeg få kaffe til morgenmaden?', {
			...LILLE_ARKIV,
			maks: 3
		});
		expect(valgt[0].id).toBe('b');
		const paaTvaers = vaelgRelevanteSvar(KORPUS, 'Min mave er hård, ingen afføring', {
			...LILLE_ARKIV,
			maks: 2
		});
		expect(paaTvaers[0].forlobId).toBe('kropsro_maj_2026');
	});

	it('vælger ikke noget når spørgsmålet ikke ligner noget i arkivet', () => {
		const valgt = vaelgRelevanteSvar(KORPUS, 'Hvornår åbner svømmehallen i Silkeborg?', {
			...LILLE_ARKIV,
			maks: 5
		});
		expect(valgt).toEqual([]);
	});

	it('holder sig under loftet', () => {
		const valgt = vaelgRelevanteSvar(KORPUS, 'protein mave kaffe forstoppelse træt', {
			...LILLE_ARKIV,
			maks: 2,
			relativGraense: 0
		});
		expect(valgt.length).toBeLessThanOrEqual(2);
	});

	it('springer de svar over der allerede er med et andet sted', () => {
		const valgt = vaelgRelevanteSvar(KORPUS, 'Jeg er forstoppet', {
			...LILLE_ARKIV,
			maks: 3,
			ekskluder: new Set(['a'])
		});
		expect(valgt.map((s) => s.id)).not.toContain('a');
	});

	it('giver en tom liste ved tomt arkiv eller tomt spørgsmål', () => {
		expect(vaelgRelevanteSvar([], 'forstoppelse', { maks: 5 })).toEqual([]);
		expect(vaelgRelevanteSvar(KORPUS, '   ', { maks: 5 })).toEqual([]);
	});

	it('tager kun svar der ligger tæt på det bedste match', () => {
		// Ét svar rammer alle tre ord, resten deler kun ét. Uden den relative
		// grænse ville udvalget fylde helt op til maks med de svage match.
		const gradueret: KorpusSvar[] = [
			svar('top', 'Forstoppelse og hård mave og oppustethed', 'Drik mere vand'),
			svar('svag1', 'Er oppustethed normalt?', 'Det svinger i starten'),
			svar('svag2', 'Min mave larmer om natten', 'Helt normalt'),
			svar('svag3', 'Hård træning eller rolig træning?', 'Start roligt'),
			svar('intet', 'Hvornår er der live?', 'Hver tirsdag')
		];
		const spm = 'Jeg har forstoppelse, hård mave og oppustethed';
		const stramt = vaelgRelevanteSvar(gradueret, spm, { minScore: 0, maks: 40 });
		const loest = vaelgRelevanteSvar(gradueret, spm, {
			minScore: 0,
			maks: 40,
			relativGraense: 0
		});
		expect(stramt[0].id).toBe('top');
		expect(stramt.length).toBeLessThan(loest.length);
	});

	it('foretrækker det nyeste svar når to er lige relevante', () => {
		const dublet: KorpusSvar[] = [
			svar('gammel', 'Er kaffe ok?', 'Ja, en kop kaffe er fint', 'x', 1000),
			svar('ny', 'Er kaffe ok?', 'Ja, en kop kaffe er fint', 'x', 5000)
		];
		// minScore saettes til 0 her: i et arkiv paa to svar er intet ord
		// sjaeldent, saa scoren er lav uanset hvor godt det matcher.
		const valgt = vaelgRelevanteSvar(dublet, 'Er kaffe ok?', { maks: 1, minScore: 0 });
		expect(valgt[0].id).toBe('ny');
	});
});
