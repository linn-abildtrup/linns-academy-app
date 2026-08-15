// ============================================================
// Etape 4 af regnemaskinen. Fra ingrediensliste til makro.
//
// Her samles de tre foerste etaper til ét tal:
//
//   "2 spsk olivenolie"
//     etape 1  ->  2 x 14 g = 28 g
//     etape 2  ->  kernenavn "olivenolie"
//     etape 3  ->  foedevaren Olivenolie, 884 kcal pr 100 g
//     etape 4  ->  28 g af 884 kcal = 248 kcal
//
// FILEN SKRIVER ALDRIG I OPSKRIFTERNE. Den laeser dem og regner ved
// siden af. Linns regel 13. august: opskrifterne skal staa ordret som
// hun har skrevet dem, ingredienser, maengder og de makrotal der staar i
// instruktioner-teksten. Resultatet her lander i sin egen samling.
//
// DAEKNING ER VIGTIGERE END SUMMEN
// Et tal der bygger paa 5 af 11 ingredienser er ikke et daarligt tal,
// det er et ufaerdigt tal. Derfor regnes daekning ud i GRAM og ikke i
// antal ingredienser. Mangler der 1 g oregano, er tallet brugbart.
// Mangler der 200 g kylling, er det ikke.
//
// Se SPEC-3.0.md 26.19.
// ============================================================

import type { Fodevare } from './kost';
import type { Ingrediens } from './opskrifter';
import { tilGram, bidragerIkke } from './enhedsvaegt3';
import { kerneNavn } from './ingrediensNavn3';
import { listenErSkrevetTil } from './opskriftPortion3';

/**
 * Det regnemaskinen skal bruge for at slaa en ingrediens op.
 * Enten et foodId i foedevaredatabasen, eller tal vi selv har slaaet op
 * fordi databasen ikke havde varen.
 */
export interface KoblingsOpslag {
	foodId: string;
	egenVare?: {
		navn: string;
		p: number;
		f: number;
		kh: number;
		fedt: number;
		kcal: number;
		kilde: string;
	};
}

export interface Makro {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kalorier: number;
}

export const TOM_MAKRO: Makro = { protein: 0, fiber: 0, kh: 0, fedt: 0, kalorier: 0 };

/** Hvorfor en ingrediens ikke kunne regnes med. */
export type Mangel =
	| 'ingen kobling'
	| 'varen findes ikke'
	| 'varen mangler tal'
	| null;

export interface IngrediensLinje {
	/** Som det staar i opskriften. */
	navn: string;
	maengde: number;
	enhed: string;
	/** Det rensede navn, altsaa noeglen i koblingen. */
	kerne: string;
	/** Vaegten i gram for hele linjen. */
	gram: number;
	/** Hvor sikker vaegten er. Se enhedsvaegt3. */
	vaegtSikkerhed: 'tabel' | 'gruppe' | 'ingen';
	/** Foedevaren der blev brugt, hvis der var en. */
	vare: Fodevare | null;
	/** Bidraget fra netop den her linje. Nul naar den ikke kunne regnes. */
	makro: Makro;
	/** Sat naar linjen IKKE kunne regnes med. */
	mangel: Mangel;
	/**
	 * Sand naar linjen med vilje ikke taeller, altsaa salt, peber og
	 * linjer uden maengde. De skal hverken taelle med i summen eller
	 * traekke daekningen ned.
	 */
	uden_betydning: boolean;
}

export interface OpskriftBeregning {
	opskriftId: string;
	titel: string;
	/** Makro for HELE ingredienslisten. */
	ialt: Makro;
	/**
	 * Makro pr portion. Ingredienslisten raekker til
	 * `listenErSkrevetTil(defaultPortioner)` portioner, saa summen
	 * deles med det tal. For 122 af de 133 opskrifter er det 1.
	 */
	prPortion: Makro;
	linjer: IngrediensLinje[];
	/** Gram der kunne regnes med. */
	gramMed: number;
	/** Gram der ikke kunne, altsaa de manglende koblinger. */
	gramUden: number;
	/**
	 * 0 til 100. Hvor stor en del af rettens vaegt der er gjort rede for.
	 * DET HER TAL AFGOER om summen er til at stole paa.
	 */
	daekning: number;
	/** Antal linjer der mangler en kobling. */
	antalMangler: number;
	/**
	 * Falsk naar mindst én af de varer der ER koblet mangler et
	 * kalorietal.
	 *
	 * Uden det her giver regnemaskinen umulige tal. En omelet med 27 g
	 * protein kan ikke have 130 kalorier, for proteinet alene er 108.
	 * Naar en vare mangler kalorier, bidrager den med protein men med
	 * nul kalorier, og summen bliver loegn. Set 13. august.
	 *
	 * Protein og fiber er stadig gyldige. Det er kun kalorierne, og
	 * dermed ogsaa kulhydrat og fedt, der ikke kan bruges.
	 */
	kalorierPaalidelige: boolean;
	/** Navnene paa de varer der mangler tal, saa de kan rettes. */
	varerUdenTal: string[];
}

function gangOp(vare: Fodevare, gram: number): Makro {
	const f = gram / 100;
	return {
		protein: (vare.p ?? 0) * f,
		fiber: (vare.f ?? 0) * f,
		kh: (vare.kh ?? 0) * f,
		fedt: (vare.fedt ?? 0) * f,
		kalorier: (vare.kcal ?? 0) * f
	};
}

function laegSammen(a: Makro, b: Makro): Makro {
	return {
		protein: a.protein + b.protein,
		fiber: a.fiber + b.fiber,
		kh: a.kh + b.kh,
		fedt: a.fedt + b.fedt,
		kalorier: a.kalorier + b.kalorier
	};
}

function del(m: Makro, n: number): Makro {
	const d = n > 0 ? n : 1;
	return {
		protein: m.protein / d,
		fiber: m.fiber / d,
		kh: m.kh / d,
		fedt: m.fedt / d,
		kalorier: m.kalorier / d
	};
}

/** Runder alle fem tal, saa de kan vises og sammenlignes. */
export function afrund(m: Makro): Makro {
	const en = (x: number) => Math.round(x * 10) / 10;
	return {
		protein: en(m.protein),
		fiber: en(m.fiber),
		kh: en(m.kh),
		fedt: en(m.fedt),
		kalorier: Math.round(m.kalorier)
	};
}

/**
 * Regner én ingrediens-linje ud.
 *
 * `koblinger` er kortet fra kernenavn til foedevare-id, og `varer` er
 * hele foedevaredatabasen.
 */
export function regnLinje(
	ing: Ingrediens,
	koblinger: Record<string, KoblingsOpslag>,
	varer: Map<string, Fodevare>
): IngrediensLinje {
	const navn = ing.navn ?? '';
	const maengde = Number(ing.maengde);
	const enhed = String(ing.enhed ?? '');
	const kerne = kerneNavn(navn);
	const v = tilGram(navn, maengde, enhed);

	// Salt, peber og linjer uden maengde. De taeller ikke, og de er
	// heller ikke en mangel. Uden det her ville hver ret se ud til at
	// mangle tre ingredienser den ikke mangler.
	const udenBetydning = v.gram === 0 || bidragerIkke(navn);

	const basis = {
		navn,
		maengde,
		enhed,
		kerne,
		gram: v.gram,
		vaegtSikkerhed: v.sikkerhed,
		uden_betydning: udenBetydning
	};

	if (udenBetydning) {
		return { ...basis, vare: null, makro: { ...TOM_MAKRO }, mangel: null };
	}

	const kobling = koblinger[kerne];
	if (!kobling) {
		return { ...basis, vare: null, makro: { ...TOM_MAKRO }, mangel: 'ingen kobling' };
	}

	// Har vi slaaet tallene op selv, fordi databasen ikke havde varen,
	// vinder de over et foodId. De ligger i koblingen og ikke i
	// foedevaredatabasen, saa de ikke dukker op i kundernes soegning.
	const vare: Fodevare | undefined = kobling.egenVare
		? {
				id: `egen:${kerne}`,
				name: kobling.egenVare.navn,
				cat: 'andet',
				p: kobling.egenVare.p,
				f: kobling.egenVare.f,
				kh: kobling.egenVare.kh,
				fedt: kobling.egenVare.fedt,
				kcal: kobling.egenVare.kcal
			}
		: varer.get(kobling.foodId);

	if (!vare) {
		return { ...basis, vare: null, makro: { ...TOM_MAKRO }, mangel: 'varen findes ikke' };
	}

	// Protein og fiber er der altid. Kulhydrat, fedt og kalorier er
	// "udvidet naering" og mangler paa nogle varer. Mangler kalorierne,
	// kan vi ikke give et aerligt kalorietal for retten, saa linjen
	// markeres. Proteinet regnes stadig med, for det er det 30-30
	// handler om.
	const manglerTal = vare.kcal === undefined;

	return {
		...basis,
		vare,
		makro: gangOp(vare, v.gram),
		mangel: manglerTal ? 'varen mangler tal' : null
	};
}

/**
 * Regner en hel opskrift ud.
 *
 * Returnerer baade summen for hele listen og tallet pr portion, samt
 * daekningen, som er det tal der afgoer om summen er til at stole paa.
 */
export function regnOpskrift(
	opskrift: {
		id: string;
		titel: string;
		ingredienser: Ingrediens[];
		defaultPortioner?: number;
	},
	koblinger: Record<string, KoblingsOpslag>,
	varer: Map<string, Fodevare>
): OpskriftBeregning {
	const linjer = (opskrift.ingredienser ?? []).map((i) => regnLinje(i, koblinger, varer));

	let ialt: Makro = { ...TOM_MAKRO };
	let gramMed = 0;
	let gramUden = 0;
	let antalMangler = 0;
	const varerUdenTal: string[] = [];

	for (const l of linjer) {
		if (l.uden_betydning) continue;
		if (l.vare) {
			ialt = laegSammen(ialt, l.makro);
			gramMed += l.gram;
			if (l.mangel === 'varen mangler tal' && !varerUdenTal.includes(l.vare.name)) {
				varerUdenTal.push(l.vare.name);
			}
		} else {
			gramUden += l.gram;
			antalMangler++;
		}
	}

	const gramIalt = gramMed + gramUden;
	const daekning = gramIalt > 0 ? Math.round((gramMed / gramIalt) * 100) : 0;
	const portioner = listenErSkrevetTil(opskrift.defaultPortioner);

	return {
		opskriftId: opskrift.id,
		titel: opskrift.titel,
		ialt,
		prPortion: del(ialt, portioner),
		linjer,
		gramMed,
		gramUden,
		daekning,
		antalMangler,
		kalorierPaalidelige: varerUdenTal.length === 0,
		varerUdenTal
	};
}

/**
 * Hvor meget det beregnede tal afviger fra det der staar i opskriften.
 * Positiv betyder at vi regner os frem til MERE end der staar.
 * Null naar der ikke er noget at sammenligne med.
 */
export function afvigelse(beregnet: number, staar: number | null): number | null {
	if (staar === null || !Number.isFinite(staar) || staar === 0) return null;
	return Math.round(((beregnet - staar) / staar) * 100);
}

/**
 * Makroen som den skal VISES for kunden.
 *
 * Er der et beregnet tal med god nok daekning, bruges det. Ellers
 * bruges det tal der staar skrevet i opskriftens tekst.
 *
 * DET ER HER DE TO VERDENER MOEDES. Den gamle app laeser videre fra
 * teksten og aendrer sig ikke. 3.0 bruger det beregnede, hvor vi har
 * det. Linns valg 13. august: vis de beregnede tal.
 *
 * Formen er den samme som parseOpskriftMakro returnerer, saa de to kan
 * bruges i flaeng, plus et flag der siger hvor tallet kommer fra.
 */
export function visMakro(
	opskriftId: string,
	instruktioner: string,
	beregninger: Record<
		string,
		{
			protein: number;
			fiber: number;
			kh: number;
			fedt: number;
			kalorier: number;
			daekning: number;
			kalorierPaalidelige: boolean;
		}
	>,
	skrevet: {
		protein: number | null;
		fiber: number | null;
		kh: number | null;
		fedt: number | null;
		kalorier: number | null;
	},
	graenseDaekning = 90
): {
	protein: number | null;
	fiber: number | null;
	kh: number | null;
	fedt: number | null;
	kalorier: number | null;
	beregnet: boolean;
} {
	const b = beregninger[opskriftId];
	if (!b || b.daekning < graenseDaekning) {
		return { ...skrevet, beregnet: false };
	}
	return {
		protein: b.protein,
		fiber: b.fiber,
		kh: b.kh,
		fedt: b.fedt,
		// Mangler en vare sit kalorietal, er summen loegn. Saa falder vi
		// tilbage paa det skrevne tal for netop kalorierne, mens protein
		// og fiber stadig er de beregnede.
		kalorier: b.kalorierPaalidelige ? b.kalorier : skrevet.kalorier,
		beregnet: true
	};
}

/**
 * Hvor meget vi tor sige om en beregning.
 *
 * Under 70 procents daekning er tallet ikke en vurdering vaerd. Saa er
 * det ikke opskriften der er forkert, det er koblingen der mangler.
 */
export function tilliden(daekning: number): 'god' | 'delvis' | 'for lidt' {
	if (daekning >= 90) return 'god';
	if (daekning >= 70) return 'delvis';
	return 'for lidt';
}
