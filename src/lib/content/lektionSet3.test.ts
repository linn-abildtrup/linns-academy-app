import { describe, expect, it } from 'vitest';
import { alleSet3, erSet3, setNoegler3, videoNoegle3 } from './lektionSet3';

const VIMEO = 'https://vimeo.com/1195153171?share=copy&fl=sv&fe=ci';
const VIMEO_ANDEN_DAG = 'https://vimeo.com/1195153171#t=0';
const ANDEN_FILM = 'https://vimeo.com/1198737982?share=copy';

describe('videoNoegle3', () => {
	it('samme film giver samme noegle, ogsaa med forskellig hale', () => {
		expect(videoNoegle3(VIMEO)).toBe(videoNoegle3(VIMEO_ANDEN_DAG));
	});

	it('to forskellige film giver to forskellige noegler', () => {
		expect(videoNoegle3(VIMEO)).not.toBe(videoNoegle3(ANDEN_FILM));
	});

	it('stoerre og mindre bogstaver er det samme', () => {
		expect(videoNoegle3('https://Vimeo.com/123')).toBe(videoNoegle3('https://vimeo.com/123'));
	});

	it('en skraastreg til sidst betyder ikke noget', () => {
		expect(videoNoegle3('https://vimeo.com/123/')).toBe(videoNoegle3('https://vimeo.com/123'));
	});

	it('ingen adresse giver ingen noegle', () => {
		expect(videoNoegle3(undefined)).toBeNull();
		expect(videoNoegle3('')).toBeNull();
		expect(videoNoegle3('   ')).toBeNull();
	});

	it('noeglen kan bruges som dokument-navn', () => {
		const n = videoNoegle3(VIMEO)!;
		expect(n.startsWith('v-')).toBe(true);
		expect(n).not.toContain('/');
		expect(n.length).toBeLessThan(30);
	});
});

describe('setNoegler3', () => {
	it('skriver baade lektionens id og videoen', () => {
		expect(setNoegler3({ id: 'lek1', url: VIMEO })).toEqual(['lek1', videoNoegle3(VIMEO)]);
	});

	it('en lektion uden video har kun sit id', () => {
		expect(setNoegler3({ id: 'lek1' })).toEqual(['lek1']);
	});
});

describe('erSet3', () => {
	it('set paa sit eget id, som foer 22. august', () => {
		expect(erSet3(new Set(['lek1']), { id: 'lek1', url: VIMEO })).toBe(true);
	});

	it('MANDAGENS FILM SET: tirsdagens egen lektion taeller ogsaa som set', () => {
		const klaret = new Set(setNoegler3({ id: 'mandag', url: VIMEO }));
		expect(erSet3(klaret, { id: 'tirsdag', url: VIMEO_ANDEN_DAG })).toBe(true);
	});

	it('en anden film er ikke set', () => {
		const klaret = new Set(setNoegler3({ id: 'mandag', url: VIMEO }));
		expect(erSet3(klaret, { id: 'onsdag', url: ANDEN_FILM })).toBe(false);
	});

	it('en tekst uden video kendes kun paa sit id', () => {
		const klaret = new Set(setNoegler3({ id: 'mandag', url: VIMEO }));
		expect(erSet3(klaret, { id: 'tekst' })).toBe(false);
		expect(erSet3(new Set(['tekst']), { id: 'tekst' })).toBe(true);
	});

	it('intet er set naar der ikke er markeret noget', () => {
		expect(erSet3(new Set(), { id: 'lek1', url: VIMEO })).toBe(false);
	});
});

describe('alleSet3', () => {
	it('en tom dag er ikke alt taget', () => {
		expect(alleSet3(new Set(['a']), [])).toBe(false);
	});

	it('alle set naar den ene er set paa id og den anden paa videoen', () => {
		const klaret = new Set(['a', ...setNoegler3({ id: 'x', url: VIMEO })]);
		expect(alleSet3(klaret, [{ id: 'a' }, { id: 'b', url: VIMEO }])).toBe(true);
	});

	it('ikke alle set naar én mangler', () => {
		expect(alleSet3(new Set(['a']), [{ id: 'a' }, { id: 'b', url: ANDEN_FILM }])).toBe(false);
	});
});
