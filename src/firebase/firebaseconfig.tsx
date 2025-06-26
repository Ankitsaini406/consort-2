'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore, collection, getDocs } from "firebase/firestore";
import { 
    getAuth, 
    Auth, 
    setPersistence, 
    inMemoryPersistence,
    browserSessionPersistence,
    browserLocalPersistence
} from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let db: Firestore | null = null;
let analytics: Analytics | null = null;

/**
 * Firebase Auth Persistence Configuration
 * 
 * SECURITY LEVELS:
 * - inMemoryPersistence: HIGHEST SECURITY - Only persists while page is open
 * - browserSessionPersistence: MEDIUM SECURITY - Persists until browser tab is closed
 * - browserLocalPersistence: LOWEST SECURITY - Persists across browser restarts
 * 
 * For admin CMS systems, inMemoryPersistence is recommended for better security
 * For development, browserLocalPersistence provides better UX
 * 
 * Can be configured via AUTH_PERSISTENCE environment variable: memory|session|local
 */
function getAuthPersistence() {
    const persistenceType = process.env.NEXT_PUBLIC_AUTH_PERSISTENCE || 'session';
    
    switch (persistenceType) {
        case 'memory':
            return inMemoryPersistence;
        case 'local':
            return browserLocalPersistence;
        case 'session':
        default:
            return browserSessionPersistence;
    }
}

const AUTH_PERSISTENCE_MODE = getAuthPersistence();

/**
 * Enhanced environment variable debugging
 * Helps diagnose why Firebase variables might not load correctly
 */
function getEnvironmentVariables() {
    return {
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
        NODE_ENV: process.env.NODE_ENV
    };
}

/**
 * Get Firebase configuration from environment variables
 */
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
 * Validate Firebase configuration
 */
function validateFirebaseConfig(config: any): boolean {
    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingKeys = requiredKeys.filter(key => !config[key]);
    
    if (missingKeys.length > 0) {
        console.error('[FIREBASE] Missing required environment variables:', 
            missingKeys.map(key => `NEXT_PUBLIC_FIREBASE_${key.toUpperCase()}`)
        );
        return false;
    }
    
    return true;
}

/**
 * CLIENT-SIDE ONLY Firebase initialization
 * This function should only be called in the browser
 */
function initializeClientFirebase(): {
    app: FirebaseApp | null;
    auth: Auth | null;
    db: Firestore | null;
    storage: FirebaseStorage | null;
    analytics: Analytics | null;
} {
    // Guard: Only initialize in browser
    if (typeof window === 'undefined') {
        console.warn('[FIREBASE] Attempted to initialize on server - skipping');
        return { app: null, auth: null, db: null, storage: null, analytics: null };
    }

    // Return existing instances if already initialized
    if (app && auth && db && storage) {
        return { app, auth, db, storage, analytics };
    }

    try {
        const firebaseConfig = getFirebaseConfig();
        
        // Validate configuration
        if (!validateFirebaseConfig(firebaseConfig)) {
            throw new Error('Invalid Firebase configuration');
        }

        // Initialize app
        if (getApps().length > 0) {
            app = getApp();
            console.log('[FIREBASE] Using existing app instance');
        } else {
            app = initializeApp(firebaseConfig);
            console.log('[FIREBASE] Initialized new app instance');
        }
        
        // Initialize services
        auth = getAuth(app);
        storage = getStorage(app);
        db = getFirestore(app);

        // Set auth persistence
        const persistenceMode = getAuthPersistence();
        setPersistence(auth, persistenceMode)
            .then(() => {
                const persistenceType = persistenceMode === inMemoryPersistence ? 'MEMORY' :
                                       persistenceMode === browserSessionPersistence ? 'SESSION' : 'LOCAL';
                console.log(`[FIREBASE] Auth persistence set to: ${persistenceType}`);
            })
            .catch((error) => {
                console.error('[FIREBASE] Error setting auth persistence:', error);
            });

        // Initialize analytics (optional)
        if (firebaseConfig.measurementId) {
            try {
                analytics = getAnalytics(app);
                console.log('[FIREBASE] Analytics initialized');
            } catch (error) {
                console.warn('[FIREBASE] Analytics initialization failed (non-critical):', error);
                analytics = null;
            }
        }

        console.log('[FIREBASE] Client initialization completed successfully');
        return { app, auth, db, storage, analytics };

    } catch (error) {
        console.error('[FIREBASE] Client initialization failed:', error);
        return { app: null, auth: null, db: null, storage: null, analytics: null };
    }
}

/**
 * Get Firebase services - CLIENT-SIDE ONLY
 * These functions will return null on server-side
 */
export function getFirebaseApp(): FirebaseApp | null {
    if (typeof window === 'undefined') return null;
    if (!app) {
        const services = initializeClientFirebase();
        return services.app;
    }
    return app;
}

export function getFirebaseAuth(): Auth | null {
    if (typeof window === 'undefined') return null;
    if (!auth) {
        const services = initializeClientFirebase();
        return services.auth;
    }
    return auth;
}

export function getFirebaseDb(): Firestore | null {
    if (typeof window === 'undefined') return null;
    if (!db) {
        const services = initializeClientFirebase();
        return services.db;
    }
    return db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
    if (typeof window === 'undefined') return null;
    if (!storage) {
        const services = initializeClientFirebase();
        return services.storage;
    }
    return storage;
}

export function getFirebaseAnalytics(): Analytics | null {
    if (typeof window === 'undefined') return null;
    if (!analytics) {
        const services = initializeClientFirebase();
        return services.analytics;
    }
    return analytics;
}

// Legacy exports for backward compatibility - these will be null on server
export { 
    getFirebaseApp as app,
    getFirebaseAuth as auth,
    getFirebaseDb as db,
    getFirebaseStorage as storage,
    getFirebaseAnalytics as analytics
};

// ==========================================
// SERVER-SIDE FIREBASE FUNCTIONALITY
// ==========================================

let serverApp: FirebaseApp | null = null;
let serverDb: Firestore | null = null;

// 🔧 BUILD-TIME OPTIMIZATION: Global Firebase state management
let isServerInitializing = false;
let initializationPromise: Promise<{ app: FirebaseApp | null; db: Firestore | null }> | null = null;
let lastInitializationAttempt = 0;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const FAILURE_COOLDOWN_MS = 30000; // 30 seconds
const INITIALIZATION_TIMEOUT_MS = 15000; // 15 seconds

// 🛡️ CIRCUIT BREAKER: Prevent repeated failed initialization attempts
function shouldAttemptInitialization(): boolean {
    const now = Date.now();
    
    // If we have too many consecutive failures, implement cooldown
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        if (now - lastInitializationAttempt < FAILURE_COOLDOWN_MS) {
            console.warn(`[FIREBASE-SERVER] Circuit breaker active. Skipping initialization (${consecutiveFailures} failures)`);
            return false;
        } else {
            // Reset after cooldown
            consecutiveFailures = 0;
            console.log(`[FIREBASE-SERVER] Circuit breaker reset after cooldown`);
        }
    }
    
    return true;
}

/**
 * 🚀 ENHANCED SERVER-SIDE Firebase initialization with build-time optimizations
 * Features: Singleton pattern, connection pooling, circuit breaker, timeout handling
 */
async function initializeServerFirebase(): Promise<{
    app: FirebaseApp | null;
    db: Firestore | null;
}> {
    // Guard: Only initialize on server
    if (typeof window !== 'undefined') {
        console.warn('[FIREBASE-SERVER] Attempted to initialize server Firebase in browser');
        return { app: null, db: null };
    }

    // 🔄 SINGLETON: Return existing instances if already initialized
    if (serverApp && serverDb) {
        console.log('[FIREBASE-SERVER] Using cached server instances');
        return { app: serverApp, db: serverDb };
    }

    // 🛡️ CIRCUIT BREAKER: Check if we should attempt initialization
    if (!shouldAttemptInitialization()) {
        return { app: null, db: null };
    }

    // 🔒 CONCURRENCY: Prevent multiple simultaneous initialization attempts
    if (isServerInitializing && initializationPromise) {
        console.log('[FIREBASE-SERVER] Initialization in progress, waiting...');
        return await initializationPromise;
    }

    // 🚀 START INITIALIZATION
    isServerInitializing = true;
    lastInitializationAttempt = Date.now();
    
    initializationPromise = new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            console.error('[FIREBASE-SERVER] Initialization timeout after 15 seconds');
            consecutiveFailures++;
            reject(new Error('Firebase server initialization timeout'));
        }, INITIALIZATION_TIMEOUT_MS);

        try {
            console.log('[FIREBASE-SERVER] Starting server Firebase initialization...');
            
            const firebaseConfig = getFirebaseConfig();
            
            // Validate configuration
            if (!validateFirebaseConfig(firebaseConfig)) {
                throw new Error('Invalid Firebase configuration');
            }

            // 🔧 OPTIMIZED APP INITIALIZATION
            const existingApps = getApps();
            if (existingApps.length > 0) {
                // Find existing server app or use default
                serverApp = existingApps.find(app => app.name === 'server-app') || getApp();
                console.log(`[FIREBASE-SERVER] Using existing app: ${serverApp.name}`);
            } else {
                serverApp = initializeApp(firebaseConfig, 'server-app');
                console.log('[FIREBASE-SERVER] Created new server app instance');
            }
            
            // 🔥 OPTIMIZED FIRESTORE INITIALIZATION
            serverDb = getFirestore(serverApp);

            // 🧪 QUICK CONNECTIVITY TEST (optional, with timeout)
            if (process.env.NODE_ENV === 'development' || process.env.FIREBASE_TEST_CONNECTION === 'true') {
                try {
                    console.log('[FIREBASE-SERVER] Testing connectivity...');
                    // Quick test query with short timeout
                    const testRef = collection(serverDb, '_test_connection');
                    const testPromise = getDocs(testRef);
                    const connectivityTimeout = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connectivity test timeout')), 5000)
                    );
                    
                    await Promise.race([testPromise, connectivityTimeout]);
                    console.log('[FIREBASE-SERVER] Connectivity test passed');
                } catch (connectivityError) {
                    console.warn('[FIREBASE-SERVER] Connectivity test failed (non-critical):', connectivityError);
                    // Don't fail initialization for connectivity issues
                }
            }

            clearTimeout(timeoutId);
            consecutiveFailures = 0; // Reset failure count on success
            
            console.log('[FIREBASE-SERVER] Server Firebase initialization completed successfully');
            resolve({ app: serverApp, db: serverDb });

        } catch (error) {
            clearTimeout(timeoutId);
            consecutiveFailures++;
            
            console.error(`[FIREBASE-SERVER] Initialization failed (attempt ${consecutiveFailures}):`, error);
            
            // Reset instances on failure
            serverApp = null;
            serverDb = null;
            
            resolve({ app: null, db: null }); // Don't reject, return null to allow fallbacks
        } finally {
            isServerInitializing = false;
            // Keep promise for a short time to handle concurrent requests
            setTimeout(() => {
                initializationPromise = null;
            }, 1000);
        }
    });

    return await initializationPromise;
}

/**
 * 🚀 ENHANCED Get server-side Firestore instance (ASYNC VERSION)
 * Features: Caching, error resilience, build-time optimization
 * 
 * @returns {Promise<Firestore | null>} Server-side Firestore instance or null if not available
 */
// Server-side functions have been moved to serverFirebase.ts 
