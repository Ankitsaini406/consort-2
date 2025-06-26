import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

let serverApp: FirebaseApp | null = null;
let serverDb: Firestore | null = null;
let isServerInitializing = false;
let initializationPromise: Promise<{ app: FirebaseApp | null; db: Firestore | null; }> | null = null;
let consecutiveFailures = 0;

/**
 * 🔒 Validate Firebase configuration
 * @param config Firebase configuration object
 * @returns boolean indicating if config is valid
 */
function validateFirebaseConfig(config: any): boolean {
    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingKeys = requiredKeys.filter(key => !config[key]);
    
    if (missingKeys.length > 0) {
        console.error('[FIREBASE-SERVER] Missing required environment variables:', 
            missingKeys.map(key => `NEXT_PUBLIC_FIREBASE_${key.toUpperCase()}`)
        );
        return false;
    }
    
    return true;
}

function getFirebaseConfig() {
    return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    };
}

/**
 * 🚀 Initialize server-side Firebase
 * @returns Promise with app and db instances
 */
async function initializeServerFirebase(): Promise<{ app: FirebaseApp | null; db: Firestore | null; }> {
    // Prevent client-side execution
    if (typeof window !== 'undefined') {
        console.warn('[FIREBASE-SERVER] Server initialization attempted in browser context');
        return { app: null, db: null };
    }

    if (initializationPromise) {
        return initializationPromise;
    }

    isServerInitializing = true;
    initializationPromise = new Promise(async (resolve) => {
        try {
            const config = getFirebaseConfig();
            if (!validateFirebaseConfig(config)) {
                throw new Error('Invalid Firebase configuration');
            }

            const apps = getApps();
            if (apps.length > 0) {
                serverApp = getApp();
            } else {
                serverApp = initializeApp(config, 'server-app');
            }

            serverDb = getFirestore(serverApp);
            resolve({ app: serverApp, db: serverDb });
        } catch (error) {
            console.error('[FIREBASE-SERVER] Initialization error:', error);
            consecutiveFailures++;
            
            // Circuit breaker pattern
            if (consecutiveFailures >= 3) {
                console.error('[FIREBASE-SERVER] Circuit breaker triggered - too many consecutive failures');
            }
            
            resolve({ app: null, db: null });
        } finally {
            isServerInitializing = false;
        }
    });

    return initializationPromise;
}

/**
 * 🚀 Get server-side Firestore instance (ASYNC VERSION)
 * @returns Promise with Firestore instance or null
 */
export async function getServerFirestoreAsync(): Promise<Firestore | null> {
    // Prevent client-side execution
    if (typeof window !== 'undefined') {
        console.warn('[FIREBASE-SERVER] getServerFirestoreAsync called in browser context');
        return null;
    }

    if (serverDb) {
        return serverDb;
    }

    try {
        const { db } = await initializeServerFirebase();
        return db;
    } catch (error) {
        console.error('[FIREBASE-SERVER] Failed to get Firestore instance:', error);
        return null;
    }
}

/**
 * 🚀 Warm up server-side Firebase connections
 * Call this before heavy server operations
 */
export async function warmupServerFirebase(): Promise<boolean> {
    // Prevent client-side execution
    if (typeof window !== 'undefined') {
        console.warn('[FIREBASE-SERVER] Warmup attempted in browser context');
        return false;
    }

    try {
        if (isServerInitializing) {
            console.log('[FIREBASE-SERVER] Already initializing - waiting...');
            await initializationPromise;
            return true;
        }

        const { app, db } = await initializeServerFirebase();
        return !!(app && db);
    } catch (error) {
        console.error('[FIREBASE-SERVER] Warmup failed:', error);
        return false;
    }
}

/**
 * 🧹 Clean up server-side Firebase connections
 */
export function cleanupServerFirebase(): void {
    // Prevent client-side execution
    if (typeof window !== 'undefined') {
        console.warn('[FIREBASE-SERVER] Cleanup attempted in browser context');
        return;
    }

    serverApp = null;
    serverDb = null;
    isServerInitializing = false;
    initializationPromise = null;
    consecutiveFailures = 0;
    console.log('[FIREBASE-SERVER] Cleaned up server connections');
}

/**
 * 🚀 Get server-side Firestore instance (SYNC VERSION)
 * @returns Firestore instance or null
 */
export function getServerFirestore(): Firestore | null {
    // Prevent client-side execution
    if (typeof window !== 'undefined') {
        console.warn('[FIREBASE-SERVER] getServerFirestore called in browser context');
        return null;
    }

    if (serverDb) {
        return serverDb;
    }

    try {
        const config = getFirebaseConfig();
        if (!validateFirebaseConfig(config)) {
            console.error('[FIREBASE-SERVER] Invalid configuration');
            return null;
        }

        const apps = getApps();
        if (apps.length > 0) {
            serverApp = getApp();
        } else {
            serverApp = initializeApp(config, 'server-app');
        }
        
        serverDb = getFirestore(serverApp);
        return serverDb;
    } catch (error) {
        console.error('[FIREBASE-SERVER] Initialization failed:', error);
        return null;
    }
} 