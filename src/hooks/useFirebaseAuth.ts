'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/firebase/firebaseconfig';

export interface FirebaseUser {
    uid: string;
    email: string;
    displayName?: string;
    emailVerified: boolean;
    accessToken?: string;
    isAdmin?: boolean;
    role?: string;
}

export interface UseFirebaseAuthReturn {
    user: FirebaseUser | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
    error: string | null;
}

export function useFirebaseAuth(): UseFirebaseAuthReturn {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Get the auth instance
        const authInstance = auth();
        
        if (!authInstance) {
            console.error('[FIREBASE-AUTH] Auth instance not available');
            setError('Firebase authentication not available');
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(
            authInstance,
            async (firebaseUser: User | null) => {
                if (firebaseUser) {
                    try {
                        // Get the ID token to check custom claims
                        const idTokenResult = await firebaseUser.getIdTokenResult();
                        const accessToken = await firebaseUser.getIdToken();
                        
                        // Make all authenticated users admin by default
                        const isAdmin = true;
                        
                        const user: FirebaseUser = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email!,
                            displayName: firebaseUser.displayName || undefined,
                            emailVerified: firebaseUser.emailVerified,
                            accessToken,
                            isAdmin,
                            role: isAdmin ? 'Admin' : 'User'
                        };

                        setUser(user);
                        setError(null);
                    } catch (error: any) {
                        console.error('[FIREBASE-AUTH] Error processing user:', error);
                        setError(error.message);
                        setUser(null);
                    }
                } else {
                    setUser(null);
                    setError(null);
                }
                setLoading(false);
            },
            (authError) => {
                console.error('[FIREBASE-AUTH] Authentication error:', authError);
                setError(authError.message);
                setLoading(false);
                setUser(null);
            }
        );

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            setError(null);
            setLoading(true);
            
            // Get the auth instance
            const authInstance = auth();
            
            if (!authInstance) {
                throw new Error('Firebase authentication not available');
            }
            
            const userCredential = await signInWithEmailAndPassword(authInstance, email.trim().toLowerCase(), password);
            
            // User state will be updated by onAuthStateChanged
            console.log('[FIREBASE-AUTH] Login successful for:', userCredential.user.email);
            
        } catch (error: any) {
            console.error('[FIREBASE-AUTH] Login failed:', error.message);
            setError(error.message);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            setError(null);
            
            // Get the auth instance
            const authInstance = auth();
            
            if (!authInstance) {
                throw new Error('Firebase authentication not available');
            }
            
            await signOut(authInstance);
            console.log('[FIREBASE-AUTH] Logout successful');
        } catch (error: any) {
            console.error('[FIREBASE-AUTH] Logout failed:', error.message);
            setError(error.message);
            throw error;
        }
    };

    return {
        user,
        login,
        logout,
        loading,
        error
    };
} 