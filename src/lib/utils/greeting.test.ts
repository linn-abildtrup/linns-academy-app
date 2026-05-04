import { describe, it, expect } from 'vitest';
import { getGreeting, getGreetingWithName } from './greeting';

describe('getGreeting', () => {
	it('returnerer Godmorgen kl. 5', () => {
		const d = new Date(2026, 0, 1, 5, 0);
		expect(getGreeting(d)).toBe('Godmorgen');
	});

	it('returnerer Godmorgen kl. 9.59', () => {
		const d = new Date(2026, 0, 1, 9, 59);
		expect(getGreeting(d)).toBe('Godmorgen');
	});

	it('returnerer God formiddag kl. 10', () => {
		const d = new Date(2026, 0, 1, 10, 0);
		expect(getGreeting(d)).toBe('God formiddag');
	});

	it('returnerer God formiddag kl. 11.59', () => {
		const d = new Date(2026, 0, 1, 11, 59);
		expect(getGreeting(d)).toBe('God formiddag');
	});

	it('returnerer God eftermiddag kl. 12', () => {
		const d = new Date(2026, 0, 1, 12, 0);
		expect(getGreeting(d)).toBe('God eftermiddag');
	});

	it('returnerer God eftermiddag kl. 17.59', () => {
		const d = new Date(2026, 0, 1, 17, 59);
		expect(getGreeting(d)).toBe('God eftermiddag');
	});

	it('returnerer Godaften kl. 18', () => {
		const d = new Date(2026, 0, 1, 18, 0);
		expect(getGreeting(d)).toBe('Godaften');
	});

	it('returnerer Godaften kl. 23', () => {
		const d = new Date(2026, 0, 1, 23, 0);
		expect(getGreeting(d)).toBe('Godaften');
	});

	it('returnerer Godaften kl. 0', () => {
		const d = new Date(2026, 0, 1, 0, 0);
		expect(getGreeting(d)).toBe('Godaften');
	});

	it('returnerer Godaften kl. 4.59', () => {
		const d = new Date(2026, 0, 1, 4, 59);
		expect(getGreeting(d)).toBe('Godaften');
	});
});

describe('getGreetingWithName', () => {
	it('tilfojer navn med komma', () => {
		const d = new Date(2026, 0, 1, 7, 0);
		expect(getGreetingWithName('Linn', d)).toBe('Godmorgen, Linn');
	});

	it('returnerer kun hilsen hvis navn er tomt', () => {
		const d = new Date(2026, 0, 1, 7, 0);
		expect(getGreetingWithName('', d)).toBe('Godmorgen');
	});

	it('virker med eftermiddag og navn', () => {
		const d = new Date(2026, 0, 1, 14, 30);
		expect(getGreetingWithName('Maria', d)).toBe('God eftermiddag, Maria');
	});
});
