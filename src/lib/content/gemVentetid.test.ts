import { describe, expect, it } from 'vitest';
import { gemMedVentetid } from './gemVentetid';

describe('gemMedVentetid', () => {
	it('giver ok naar serveren kvitterer i tide', async () => {
		const r = await gemMedVentetid(Promise.resolve('id123'), 50);
		expect(r).toEqual({ status: 'ok', vaerdi: 'id123' });
	});

	it('giver venter naar skrivningen bliver haengende', async () => {
		// En skrivning uden forbindelse bliver aldrig faerdig. Den efterlignes
		// her med et loefte der aldrig indfries.
		const r = await gemMedVentetid(new Promise(() => {}), 20);
		expect(r).toEqual({ status: 'venter' });
	});

	it('giver fejl naar skrivningen bliver afvist', async () => {
		const r = await gemMedVentetid(Promise.reject(new Error('nej')), 50);
		expect(r.status).toBe('fejl');
	});

	it('venter ikke laengere end noedvendigt naar svaret kommer', async () => {
		const start = Date.now();
		await gemMedVentetid(Promise.resolve(1), 5000);
		expect(Date.now() - start).toBeLessThan(200);
	});
});
