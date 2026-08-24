// ============================================================
// VARER KUNDERNE HAR SCANNET. Se HANDOVER-3.0.md 9.51.
//
// Egen samling ved siden af `fodevarer`, og det er hele pointen. Kunne
// kunderne skrive i den faelles liste, kunne én kunde aendre AEg til
// 999 g protein for alle 760. Her kan hun kun laegge noget NYT til.
// Reglen blev udgivet 24. august, se firestore.rules.
//
// DOKUMENT-ID ER STREGKODEN. To kunder der scanner den samme yoghurt
// rammer det samme sted, og den FOERSTE vinder. Firestore afviser den
// anden af sig selv, saa der skal ingen kode til at haandtere kapløbet.
// Er tallene forkerte, tager den naeste sit eget billede og faar sin
// egen private udgave. Linns regel 24. august.
//
// Den fjortende fil i 3.0 der skriver kundedata.
// ============================================================

import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '$lib/firebase';
import type { Fodevare } from '$lib/content/kost';
import type { Vare3 } from '$lib/content/fodevareKilde3';

const SAMLING = 'scannedeVarer3';
/** Samme cache-tid som foedevarerne. Listen aendrer sig langsomt. */
const CACHE_MS = 5 * 60 * 1000;
let cache: { hentetMs: number; liste: Vare3[] } | null = null;

/** Alle scannede varer. De ses af ALLE, ogsaa nye kunder. */
export async function hentScannedeVarer3(): Promise<Vare3[]> {
	if (cache && Date.now() - cache.hentetMs < CACHE_MS) return cache.liste;
	try {
		const snap = await getDocs(collection(db, SAMLING));
		const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vare3);
		cache = { hentetMs: Date.now(), liste };
		return liste;
	} catch (e) {
		// Gaar det galt, mangler hun de scannede varer og har resten.
		// Bedre end en tom skaerm.
		console.error('[ny] kunne ikke hente scannede varer', e);
		return cache?.liste ?? [];
	}
}

export function rydScannedeVarer3Cache(): void {
	cache = null;
}

/** Id'et er stregkoden naar der er en, saa to scanninger moedes. */
export function idFor(barcode: string | null): string {
	return barcode ? `bc_${barcode.replace(/[^0-9A-Za-z]/g, '')}` : doc(collection(db, SAMLING)).id;
}

/**
 * Laegger billedet af varedeklarationen op.
 *
 * DET ER BEVISET, og det er derfor varen overhovedet maa deles med
 * andre. Uden det ville vi sende én kundes tastearbejde videre til alle.
 *
 * Uid'et staar i stien, saa det altid kan ses hvem der har lagt et
 * billede op, og ingen kan overskrive en andens. Reglen er udgivet 24.
 * august, se storage.rules.
 *
 * FEJLER ALDRIG OPAD. Gaar uploaden galt, gemmes varen alligevel med
 * tallene. Et manglende bevis er bedre end en mistet scanning.
 */
export async function gemDeklarationsbillede(
	uid: string,
	vareId: string,
	billede: Blob
): Promise<string | null> {
	try {
		const endelse = billede.type.includes('webp') ? 'webp' : 'jpg';
		const sti = `deklarationer/${uid}/${vareId}.${endelse}`;
		const svar = await uploadBytes(ref(storage, sti), billede, { contentType: billede.type });
		return await getDownloadURL(svar.ref);
	} catch (e) {
		console.error('[ny] kunne ikke gemme billedet af deklarationen', e);
		return null;
	}
}

export interface NyScanning {
	navn: string;
	barcode: string | null;
	/** Adressen paa billedet af deklarationen. Beviset bag tallene. */
	billedeUrl?: string | null;
	billedeSti?: string | null;
	p: number;
	f: number | null;
	kh: number | null;
	fedt: number | null;
	kcal: number | null;
}

/**
 * Deler en scanning med alle.
 *
 * Returnerer id'et naar det lykkedes, og null naar reglen sagde nej.
 * Det sker naar en anden kunde allerede har scannet den samme stregkode,
 * og det er ikke en fejl: hendes vare findes bare i forvejen, og
 * kalderen skal bruge den der ligger.
 */
export async function delScanning(uid: string, v: NyScanning): Promise<string | null> {
	const id = idFor(v.barcode);
	try {
		await setDoc(doc(db, SAMLING, id), {
			name: v.navn,
			cat: 'andet',
			p: v.p,
			// Fiber der ikke stod paa pakken gemmes som 0, for den faelles
			// type kraever et tal. At den MANGLEDE staar i fiberUkendt, saa
			// vi kan vise det uden at lyve i regnestykket.
			f: v.f ?? 0,
			fiberUkendt: v.f === null,
			...(v.kh !== null ? { kh: v.kh } : {}),
			...(v.fedt !== null ? { fedt: v.fedt } : {}),
			...(v.kcal !== null ? { kcal: v.kcal } : {}),
			kildeType: 'scannet',
			scannetAf: uid,
			...(v.billedeUrl ? { billedeUrl: v.billedeUrl } : {}),
			...(v.billedeSti ? { billedeSti: v.billedeSti } : {}),
			...(v.barcode ? { barcode: v.barcode } : {}),
			scannetDen: new Date().toISOString()
		});
		rydScannedeVarer3Cache();
		return id;
	} catch (e) {
		// Reglen afviser den anden der scanner samme stregkode. Det er
		// meningen, saa vi siger ikke fejl til kunden.
		console.warn('[ny] kunne ikke dele scanningen, den findes nok i forvejen', e);
		return null;
	}
}

/**
 * Til admin-noedbremsen. Kun Linn kan komme igennem reglen.
 *
 * Varen SLETTES IKKE, den maerkes som fjernet. De maaltider hvor den er
 * brugt skal blive ved med at virke, se regel 10. Billedet slettes til
 * gengaeld helt, for det er der ingen grund til at gemme paa.
 */
export async function fjernScanning(id: string, billedeSti?: string | null): Promise<void> {
	await setDoc(doc(db, SAMLING, id), { fjernet: true }, { merge: true });
	if (billedeSti) {
		try {
			await deleteObject(ref(storage, billedeSti));
		} catch (e) {
			console.warn('[ny] kunne ikke slette billedet', e);
		}
	}
	rydScannedeVarer3Cache();
}

/** De scannede lagt sammen med den faelles liste, uden dubletter. */
export function medScannede(faelles: Fodevare[], scannede: Vare3[]): Fodevare[] {
	const kendte = new Set(faelles.map((f) => f.id));
	return [...faelles, ...scannede.filter((s) => !kendte.has(s.id) && !(s as { fjernet?: boolean }).fjernet)];
}
