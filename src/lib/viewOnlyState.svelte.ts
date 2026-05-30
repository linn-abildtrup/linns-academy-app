// Read-only impersonate-mode: admin kan klikke 'Se som hende' paa en klient
// i admin-listen og se app'en med klientens data. Alle skrive-handlinger
// blokeres centralt — saa selv hvis admin klikker en 'Gem'-knap, gaar der
// intet til Firestore.
//
// State holdes i localStorage (kun i session — forsvinder ved browser-luk)
// og afspejles i denne svelte-state for reaktivitet i UI'et.

const NOEGLE = 'la_admin_impersonate_uid_v1';

let _impersonateUid = $state<string | null>(null);
let _initialiseret = false;

function laesFraStorage(): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const v = localStorage.getItem(NOEGLE);
		return v && v.length > 0 ? v : null;
	} catch {
		return null;
	}
}

function initialiserHvisNoedvendigt() {
	if (_initialiseret) return;
	_initialiseret = true;
	_impersonateUid = laesFraStorage();
}

/**
 * Returnerer den uid admin aktuelt impersonerer, eller null hvis ingen.
 * Reaktiv — komponenter der laeser denne, opdateres automatisk ved aendring.
 */
export function impersonateUid(): string | null {
	initialiserHvisNoedvendigt();
	return _impersonateUid;
}

/**
 * True naar admin er i impersonate-mode. Bruges af skrive-helpers og UI til
 * at blokere skrive-handlinger.
 */
export function erViewOnly(): boolean {
	initialiserHvisNoedvendigt();
	return _impersonateUid !== null;
}

/**
 * Starter impersonation paa en klient-uid. Persisteres til localStorage
 * (kun i session).
 */
export function startImpersonate(uid: string): void {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem(NOEGLE, uid);
		} catch {
			// ignore
		}
	}
	_impersonateUid = uid;
	_initialiseret = true;
}

/**
 * Forlader impersonate-mode og vender tilbage til admin's eget view.
 */
export function forladImpersonate(): void {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.removeItem(NOEGLE);
		} catch {
			// ignore
		}
	}
	_impersonateUid = null;
	_initialiseret = true;
}

// =============================================================================
// Toast-mekanisme til read-only-besked
// =============================================================================

let _toast = $state<string | null>(null);

/**
 * Vis kort 'Read-only — handlingen blev ikke gemt'-toast.
 */
export function visReadOnlyToast(): void {
	_toast = 'Read-only — handlingen blev ikke gemt';
	setTimeout(() => {
		if (_toast === 'Read-only — handlingen blev ikke gemt') _toast = null;
	}, 2400);
}

export function aktuelToast(): string | null {
	return _toast;
}

export function ryToast(): void {
	_toast = null;
}

/**
 * Wrapper til skrive-funktioner i Firestore-helpers. Hvis i view-only-mode,
 * vises toast og funktionen returnerer null uden at kalde fn(). Ellers
 * koeres fn() normalt.
 */
export async function safeWrite<T>(fn: () => Promise<T>): Promise<T | null> {
	if (erViewOnly()) {
		visReadOnlyToast();
		return null;
	}
	return await fn();
}

/**
 * Kald i toppen af skrive-funktioner. Hvis i view-only-mode, vises toast og
 * funktionen returnerer false saa caller kan early-return. Ellers true.
 *
 * Bruges som:
 *   export async function gemNoget(...) {
 *     if (!kanSkrive()) return;
 *     // ... normal skrive-logik
 *   }
 */
export function kanSkrive(): boolean {
	if (erViewOnly()) {
		visReadOnlyToast();
		return false;
	}
	return true;
}
