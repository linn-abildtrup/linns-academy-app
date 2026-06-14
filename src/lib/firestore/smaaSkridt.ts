// Firestore-helpers for samlede små skridt (admin).
// Datamodel: forlob/{forlobId}/smaaSkridt/{auto-id}
//   { checkId: string, label: string, plan: SmaaSkridtPlan, oprettetAf, oprettetAt }
//
// checkId er det stabile id der bruges som nøgle i vaneprogram.checks og i
// kundens svar. Synken (synkSmaaSkridtTilDage) skriver hvert lille skridt ind på
// de dage dets plan rammer — så kunden ser dem via det eksisterende dag-system.

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	updateDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import { dageForPlan, type SmaaSkridt, type SmaaSkridtPlan } from '$lib/content/smaaSkridt';
import type { VaneProgramDag } from '$lib/content/vaner';
import { gemVaneprogramDag, hentVaneprogramForForlob } from '$lib/firestore/vaner';

function smaaSkridtCol(forlobId: string) {
	return collection(db, 'forlob', forlobId, 'smaaSkridt');
}

export async function hentSmaaSkridt(forlobId: string): Promise<SmaaSkridt[]> {
	const q = query(smaaSkridtCol(forlobId), orderBy('oprettetAt', 'asc'));
	const snap = await getDocs(q);
	return snap.docs.map((d) => {
		const data = d.data() as Omit<SmaaSkridt, 'id'>;
		// Bagudkompat: skridt oprettet før checkId fandtes bruger doc-id'et som
		// stabilt checkId.
		return { ...data, id: d.id, checkId: data.checkId ?? d.id };
	});
}

function nyCheckId(): string {
	const r =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().slice(0, 8)
			: Math.random().toString(36).slice(2, 10);
	return `ss-${r}`;
}

export async function opretSmaaSkridt(
	forlobId: string,
	label: string,
	plan: SmaaSkridtPlan,
	oprettetAf: string,
	checkId: string = nyCheckId()
): Promise<SmaaSkridt> {
	const data = { checkId, label: label.trim(), plan, oprettetAf, oprettetAt: serverTimestamp() };
	const ref = await addDoc(smaaSkridtCol(forlobId), data);
	return { id: ref.id, checkId, label: label.trim(), plan, oprettetAf };
}

export async function opdaterSmaaSkridt(
	forlobId: string,
	id: string,
	label: string,
	plan: SmaaSkridtPlan
): Promise<void> {
	// checkId røres ikke — det skal være stabilt så kundens svar bevares.
	await updateDoc(doc(db, 'forlob', forlobId, 'smaaSkridt', id), { label: label.trim(), plan });
}

export async function sletSmaaSkridt(forlobId: string, id: string): Promise<void> {
	await deleteDoc(doc(db, 'forlob', forlobId, 'smaaSkridt', id));
}

/**
 * Synkroniserer alle små skridt ind i forløbets vaneprogram-dage (checks), så
 * kunden ser dem via det eksisterende dag-system.
 *
 * Princip (idempotent fuld-afstemning):
 *  - "Ejede" checks = dem hvis id matcher et lille skridts checkId.
 *  - For hver dag bevares alle IKKE-ejede checks (legacy faste vaner), og de
 *    ejede erstattes af præcis de små skridt hvis plan rammer dagen.
 *  - Kun dage der faktisk ændrer sig skrives.
 *
 * Returnerer antal dage der blev opdateret (til "før/efter"-verificering).
 */
export async function synkSmaaSkridtTilDage(
	forlobId: string,
	antalDage: number,
	startDato: Date
): Promise<number> {
	const skridt = await hentSmaaSkridt(forlobId);
	const ejedeIds = new Set(skridt.map((s) => s.checkId));

	// dagNummer -> ejede checks der skal være på dagen
	const ejetPrDag = new Map<number, { id: string; label: string }[]>();
	for (const s of skridt) {
		for (const d of dageForPlan(s.plan, antalDage, startDato)) {
			const liste = ejetPrDag.get(d) ?? [];
			liste.push({ id: s.checkId, label: s.label });
			ejetPrDag.set(d, liste);
		}
	}

	const eksisterende = await hentVaneprogramForForlob(forlobId);
	const dagMap = new Map<number, VaneProgramDag>();
	for (const dag of eksisterende) dagMap.set(dag.dagNummer, dag);

	let opdateret = 0;
	const skrivninger: Promise<void>[] = [];

	for (let d = 1; d <= antalDage; d++) {
		const ejet = ejetPrDag.get(d) ?? [];
		const dag = dagMap.get(d);

		// Bevar ikke-ejede checks (legacy faste vaner), tilføj de ejede.
		const behold = (dag?.checks ?? []).filter((c) => !ejedeIds.has(c.id));
		const nyChecks = [...behold, ...ejet];

		// Hvis dagen ikke findes og der ikke er noget ejet at lægge ind: spring over.
		if (!dag && ejet.length === 0) continue;

		// Skift kun hvis checks reelt ændrer sig.
		const gammel = dag?.checks ?? [];
		const uaendret =
			gammel.length === nyChecks.length &&
			gammel.every((c, i) => c.id === nyChecks[i].id && c.label === nyChecks[i].label);
		if (dag && uaendret) continue;

		const opdateretDag: VaneProgramDag = dag
			? { ...dag, checks: nyChecks }
			: {
					dagNummer: d,
					uge: Math.ceil(d / 7),
					reflection: '',
					checks: nyChecks,
					bonus: null,
					isCheckin: false,
					isBaseline: false,
					isWin: false
				};
		skrivninger.push(gemVaneprogramDag(forlobId, opdateretDag));
		opdateret++;
	}

	await Promise.all(skrivninger);
	return opdateret;
}
