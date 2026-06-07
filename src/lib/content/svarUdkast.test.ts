import { describe, it, expect } from 'vitest';
import {
	byggFaqTekst,
	byggKlientKontekstTekst,
	byggSystemBlocks,
	byggTidligereSvarTekst,
	byggUserMessage,
	byggVidenbaseTekst,
	erTrivielBesked,
	fjernLangeTankestreger,
	parseModelOutput
} from './svarUdkast';

describe('erTrivielBesked', () => {
	it('returnerer true for meget korte beskeder', () => {
		expect(erTrivielBesked('Tak!')).toBe(true);
		expect(erTrivielBesked('Ok')).toBe(true);
		expect(erTrivielBesked('')).toBe(true);
	});

	it('returnerer true for korte tak-beskeder', () => {
		expect(erTrivielBesked('tak for hjælpen!')).toBe(true);
		expect(erTrivielBesked('Super, tak')).toBe(true);
		expect(erTrivielBesked('Forstået, tak Linn')).toBe(true);
	});

	it('returnerer false for substantielle spørgsmål', () => {
		expect(
			erTrivielBesked('Hvor mange portioner kan jeg lave af opskriften til 4 personer?')
		).toBe(false);
		expect(
			erTrivielBesked('Jeg har det dårligt om morgenen, kan jeg ændre på madplanen?')
		).toBe(false);
	});

	it('returnerer false for længere tak-beskeder med spørgsmål', () => {
		expect(
			erTrivielBesked(
				'Tak for svaret! Jeg har dog endnu et spørgsmål om træningsprogrammet — kan jeg lave det uden kettlebells?'
			)
		).toBe(false);
	});
});

describe('byggFaqTekst', () => {
	it('returnerer placeholder når FAQ er tom', () => {
		expect(byggFaqTekst([])).toContain('tom');
	});

	it('nummererer og formaterer items', () => {
		const tekst = byggFaqTekst([
			{ titel: 'Hvor lang er forløbet?', svar: '84 dage' },
			{ titel: 'Kan jeg pause?', svar: 'Ja, op til 21 dage' }
		]);
		expect(tekst).toContain('[1] Hvor lang er forløbet?');
		expect(tekst).toContain('[2] Kan jeg pause?');
		expect(tekst).toContain('84 dage');
	});

	it('trimmer meget lange svar', () => {
		const langSvar = 'a'.repeat(2000);
		const tekst = byggFaqTekst([{ titel: 'Test', svar: langSvar }]);
		expect(tekst.length).toBeLessThan(langSvar.length);
		expect(tekst).toContain('…');
	});
});

describe('byggTidligereSvarTekst', () => {
	it('returnerer hint når historik er tom', () => {
		expect(byggTidligereSvarTekst([])).toContain('Ingen tidligere svar');
	});

	it('formaterer som few-shot eksempler', () => {
		const tekst = byggTidligereSvarTekst([
			{ spoergsmaal: 'Hvor mange kalorier?', svar: 'Det afhænger af din vægt og aktivitetsniveau.' }
		]);
		expect(tekst).toContain('Eksempel 1');
		expect(tekst).toContain('Klient spurgte');
		expect(tekst).toContain('Linn svarede');
	});
});

describe('byggKlientKontekstTekst', () => {
	it('inkluderer kun de felter der er sat', () => {
		const tekst = byggKlientKontekstTekst({
			fornavn: 'Lone',
			kundeType: null,
			dagIForlob: null,
			programValg: null
		});
		expect(tekst).toBe('Fornavn: Lone');
	});

	it('formaterer fuld kontekst med separator', () => {
		const tekst = byggKlientKontekstTekst({
			fornavn: 'Lone',
			kundeType: 'forlobskunde',
			dagIForlob: 12,
			programValg: 'kropsro_84_med_kb'
		});
		expect(tekst).toContain('Fornavn: Lone');
		expect(tekst).toContain('Dag i forløbet: 12');
		expect(tekst).toContain('kropsro_84_med_kb');
		expect(tekst).toContain('·');
	});
});

describe('byggSystemBlocks', () => {
	it('returnerer to blokke hvor den sidste har cache_control', () => {
		const blocks = byggSystemBlocks({
			faqTekst: 'FAQ',
			videnbaseTekst: 'VB',
			tidligereSvarTekst: 'HS'
		});
		expect(blocks).toHaveLength(2);
		expect(blocks[0].cache_control).toBeUndefined();
		expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
		expect(blocks[1].text).toContain('FAQ');
		expect(blocks[1].text).toContain('VB');
		expect(blocks[1].text).toContain('HS');
	});
});

describe('byggUserMessage', () => {
	it('inkluderer klient-kontekst og spørgsmål', () => {
		const msg = byggUserMessage({
			klientKontekstTekst: 'Fornavn: Lone',
			sidsteBeskeder: [],
			spoergsmaalTekst: 'Hvad spiser jeg til frokost?'
		});
		expect(msg).toContain('Fornavn: Lone');
		expect(msg).toContain('Hvad spiser jeg til frokost?');
		expect(msg).toContain('JSON');
	});

	it('udelader "tidligere udveksling" når der ikke er nogen', () => {
		const msg = byggUserMessage({
			klientKontekstTekst: 'Fornavn: Lone',
			sidsteBeskeder: [],
			spoergsmaalTekst: 'Et spørgsmål'
		});
		expect(msg).not.toContain('Tidligere udveksling');
	});
});

describe('parseModelOutput', () => {
	it('parser rent JSON', () => {
		const raw = '{"udkast":"Hej Lone, godt spørgsmål!","lavSikkerhed":false,"skip":false,"skipBegrundelse":null}';
		const res = parseModelOutput(raw);
		expect(res).not.toBeNull();
		expect(res?.udkast).toBe('Hej Lone, godt spørgsmål!');
		expect(res?.lavSikkerhed).toBe(false);
		expect(res?.skip).toBe(false);
	});

	it('parser JSON pakket i markdown code fence', () => {
		const raw = '```json\n{"udkast":"Hej","lavSikkerhed":false,"skip":false,"skipBegrundelse":null}\n```';
		const res = parseModelOutput(raw);
		expect(res?.udkast).toBe('Hej');
	});

	it('parser JSON med prosa rundt om', () => {
		const raw = 'Her er mit udkast:\n{"udkast":"Hej","lavSikkerhed":true,"skip":false,"skipBegrundelse":null}\nHåber det hjælper.';
		const res = parseModelOutput(raw);
		expect(res?.udkast).toBe('Hej');
		expect(res?.lavSikkerhed).toBe(true);
	});

	it('returnerer null hvis output ikke kan parses', () => {
		expect(parseModelOutput('det er ikke JSON')).toBeNull();
		expect(parseModelOutput('{ malformed json')).toBeNull();
	});

	it('default-er lavSikkerhed og skip til false hvis ikke sat', () => {
		const raw = '{"udkast":"Hej"}';
		const res = parseModelOutput(raw);
		expect(res?.lavSikkerhed).toBe(false);
		expect(res?.skip).toBe(false);
		expect(res?.skipBegrundelse).toBeNull();
	});
});

describe('byggVidenbaseTekst', () => {
	it('returnerer placeholder for tom liste', () => {
		expect(byggVidenbaseTekst([])).toContain('Ingen');
	});

	it('nummererer uddrag', () => {
		const tekst = byggVidenbaseTekst(['Første', 'Andet']);
		expect(tekst).toContain('[1] Første');
		expect(tekst).toContain('[2] Andet');
	});
});

describe('fjernLangeTankestreger', () => {
	it('erstatter em-dash med komma naar omkranset af mellemrum', () => {
		expect(fjernLangeTankestreger('hej Lone — godt sporgsmaal')).toBe('hej Lone, godt sporgsmaal');
	});

	it('erstatter en-dash med komma naar omkranset af mellemrum', () => {
		expect(fjernLangeTankestreger('hej Lone – godt sporgsmaal')).toBe('hej Lone, godt sporgsmaal');
	});

	it('erstatter em-dash uden mellemrum med almindelig bindestreg', () => {
		expect(fjernLangeTankestreger('kropsro—maj')).toBe('kropsro-maj');
	});

	it('lader almindelig bindestreg vaere uroert', () => {
		expect(fjernLangeTankestreger('30-30-3 metoden')).toBe('30-30-3 metoden');
	});

	it('haandterer flere em-dashes i samme tekst', () => {
		expect(fjernLangeTankestreger('A — B — C')).toBe('A, B, C');
	});
});

describe('byggSystemBlocks force', () => {
	it('tilfoejer FORCE_INSTRUKTION naar force=true', () => {
		const blocks = byggSystemBlocks({
			faqTekst: 'FAQ',
			videnbaseTekst: 'VB',
			tidligereSvarTekst: 'HS',
			force: true
		});
		expect(blocks).toHaveLength(3);
		expect(blocks[2].text).toContain('Admin har bedt om et udkast');
	});

	it('udelader force-block naar force ikke er sat', () => {
		const blocks = byggSystemBlocks({
			faqTekst: 'FAQ',
			videnbaseTekst: 'VB',
			tidligereSvarTekst: 'HS'
		});
		expect(blocks).toHaveLength(2);
	});
});

describe('parseModelOutput strips em-dash', () => {
	it('fjerner em-dash fra udkast automatisk', () => {
		const raw = '{"udkast":"Hej Lone — godt sporgsmaal","lavSikkerhed":false,"skip":false,"skipBegrundelse":null}';
		const res = parseModelOutput(raw);
		expect(res?.udkast).toBe('Hej Lone, godt sporgsmaal');
	});
});
