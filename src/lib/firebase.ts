// Firebase initialization for Linn's Academy
// This file sets up Firebase services (Auth, Firestore) for use across the app.
// Configuration values come from .env via SvelteKit's $env/static/public module.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
	getFirestore,
	initializeFirestore,
	persistentLocalCache,
	persistentSingleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_PROJECT_ID,
	PUBLIC_FIREBASE_STORAGE_BUCKET,
	PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	PUBLIC_FIREBASE_APP_ID
} from '$env/static/public';

const firebaseConfig = {
	apiKey: PUBLIC_FIREBASE_API_KEY,
	authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: PUBLIC_FIREBASE_APP_ID
};

// Avoid re-initializing Firebase during hot-reload in development.
const erFoerste = getApps().length === 0;
const app = erFoerste ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
// ignoreUndefinedProperties: true lader Firestore skippe undefined-felter
// stille i stedet for at smide fejl. Vigtigt for vores typer der har optional
// felter (fx MaaltidsItem.enhedId og .manuel) — uden det fejler setDoc med
// "Function setDoc() called with invalid data. Unsupported field value: undefined"
// så snart en bruger gemmer et dokument hvor et optional felt ikke er sat.
//
// localCache: persistentLocalCache cacher hver doc i browserens IndexedDB.
// Repeat-loads serves fra cache i 0-2 ms i stedet for 100-300 ms over
// netværk. Firebase håndterer cache-invalidation automatisk.
//
// ENKELT FANE, IKKE FLERE. Vi kørte før med persistentMultipleTabManager, så
// flere faner kunne dele den samme kopi. Den deling kræver at fanerne bliver
// enige om hvem der har styringen, og netop den forhandling kan sætte sig
// fast første gang lageret bygges op efter en frisk installation. Resultatet
// var en app der stod og "hentede data" i det uendelige: Auth svarede på et
// par hundrede millisekunder, og derefter blev der IKKE sendt ét eneste kald
// til Firestore. Maalt 29. august 2026 i Chrome, gentaget flere gange efter
// at have ryddet alt lokalt, altså det samme som at slette appen fra
// telefonen.
//
// En app på en telefon er altid én fane, så delingen gav ingen værdi der.
// Prisen er, at har man appen åben i to faner på en computer samtidig, får
// den anden fane ikke den lokale kopi og bliver lidt langsommere. Ingen data
// er i fare, og ingen mister noget.
//
// Hvis IndexedDB ikke er tilgængelig (private mode, kvota-fuld) falder
// Firebase SDK stille tilbage til memory-only cache — vi behøver ikke
// håndtere fejlen eksplicit.
export const db = erFoerste
	? initializeFirestore(app, {
			ignoreUndefinedProperties: true,
			localCache: persistentLocalCache({
				tabManager: persistentSingleTabManager(undefined)
			})
		})
	: getFirestore(app);
export const storage = getStorage(app);
