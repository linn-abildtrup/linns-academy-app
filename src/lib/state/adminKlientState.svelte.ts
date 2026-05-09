// Global state for admin-klient-mode. Sat fra app/+layout.svelte hver gang
// userDoc opdateres. Læses af firestore-helpers så de kan scope deres
// læs/skriv-paths uden at hver kalder skal sende mode'n med som parameter.

let aktivKlientForlobId = $state<string | null>(null);

export function setAktivKlientForlobId(id: string | null) {
	aktivKlientForlobId = id;
}

export function getAktivKlientForlobId(): string | null {
	return aktivKlientForlobId;
}
