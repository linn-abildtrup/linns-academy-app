export type KoebType = 'forlob' | 'modul' | 'app';
export type KoebStatus = 'aktiv' | 'udlobet' | 'laeseadgang';

export interface Koeb {
  id: string;
  navn: string;
  kortNavn: string;
  type: KoebType;
  status: KoebStatus;
  lobende: boolean;
  udlobsdato?: string;
}

import type { UserState } from '$lib/types';

const KICKSTART_AKTIV: Koeb = {
  id: 'kickstart-aktiv',
  navn: 'Kickstart en sund overgangsalder',
  kortNavn: 'Kickstart',
  type: 'forlob',
  status: 'aktiv',
  lobende: false,
  udlobsdato: '2026-05-18'
};

const KICKSTART_LAESEADGANG: Koeb = {
  id: 'kickstart-laeseadgang',
  navn: 'Kickstart en sund overgangsalder',
  kortNavn: 'Kickstart',
  type: 'forlob',
  status: 'laeseadgang',
  lobende: false,
  udlobsdato: '2026-11-15'
};

const VANETRACKER_AKTIV: Koeb = {
  id: 'vanetracker-aktiv',
  navn: 'Vanetracker',
  kortNavn: 'Vanetracker',
  type: 'app',
  status: 'aktiv',
  lobende: true
};

const VANETRACKER_LAESEADGANG: Koeb = {
  id: 'vanetracker-laeseadgang',
  navn: 'Vanetracker',
  kortNavn: 'Vanetracker',
  type: 'app',
  status: 'laeseadgang',
  lobende: true
};

const MIKROTRAENING: Koeb = {
  id: 'mikrotraening',
  navn: 'Mikrotræning',
  kortNavn: 'Mikrotræning',
  type: 'modul',
  status: 'aktiv',
  lobende: true
};

const KOST_MODUL: Koeb = {
  id: 'kost-modul',
  navn: 'Kost-modul',
  kortNavn: 'Kost',
  type: 'modul',
  status: 'aktiv',
  lobende: true
};

export function getKoebForUser(state: UserState): Koeb[] {
  if (state === 'forlobskunde') {
    return [KICKSTART_AKTIV, VANETRACKER_AKTIV];
  }
  if (state === 'modulbruger') {
    return [VANETRACKER_AKTIV, MIKROTRAENING, KOST_MODUL];
  }
  if (state === 'udlobet') {
    return [KICKSTART_LAESEADGANG, VANETRACKER_LAESEADGANG];
  }
  return [];
}

export function formatUdlobsdato(dato: string): string {
  const d = new Date(dato);
  const dage = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  const maaneder = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${d.getDate()}. ${maaneder[d.getMonth()]} ${d.getFullYear()}`;
}
