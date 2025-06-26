"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirebaseAuth } from '@/firebase/firebaseconfig';
import { User as FirebaseUser } from 'firebase/auth';

// Legacy user type for compatibility
interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

export interface UserContextType {
    user: FirebaseUser | null;
    isLoading: boolean;
    error: Error | null;
    email: string | null;
}

const UserContext = createContext<UserContextType>({
    user: null,
    isLoading: true,
    error: null,
    email: null
});

export const useUser = () => useContext(UserContext);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const auth = getFirebaseAuth();
        if (!auth) {
            setError(new Error('Firebase Auth not initialized'));
            setIsLoading(false);
            return;
        }

        const unsubscribe = auth.onAuthStateChanged(
            (user) => {
                setUser(user);
                setIsLoading(false);
            },
            (error) => {
                setError(error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return (
        <UserContext.Provider value={{ 
            user, 
            isLoading, 
            error,
            email: user?.email || null
        }}>
            {children}
        </UserContext.Provider>
    );
}; 