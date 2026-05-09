// Firebase initialization for Linn's Academy
// This file sets up Firebase services (Auth, Firestore) for use across the app.
// Configuration values come from .env via SvelteKit's $env/static/public module.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
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
export const db = erFoerste
	? initializeFirestore(app, { ignoreUndefinedProperties: true })
	: getFirestore(app);
export const storage = getStorage(app);
