import { getServerFirestoreAsync } from '@/firebase/serverFirebase';
import { collection, getDocs } from 'firebase/firestore';

interface ClientLogo {
    slug: string;
    label: string;
    imageUrl: string;
}

let cachedClientLogos: ClientLogo[] | null = null;

export async function getAllClientLogos(): Promise<ClientLogo[]> {
    if (cachedClientLogos) {
        console.log('[SSG] Using cached client logos');
        return cachedClientLogos;
    }

    try {
        // 🚀 ENHANCED: Use async server-side Firestore for better build performance
        const db = await getServerFirestoreAsync();
        if (!db) {
            console.warn('[SSG] Server Firestore not available - client logos will be empty');
            return [];
        }

        console.log('[SSG] Fetching client logos from Firestore...');
        const clientsRef = collection(db, 'clients');
        
        // Add timeout for build resilience
        const fetchPromise = getDocs(clientsRef);
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Client logos fetch timeout')), 15000);
        });
        
        const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
        
        cachedClientLogos = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                slug: data.slug || doc.id,
                label: data.label || '',
                imageUrl: data.imageUrl || '',
            };
        });

        console.log(`[SSG] Successfully loaded ${cachedClientLogos.length} client logos`);
        return cachedClientLogos;
        
    } catch (error) {
        console.error('[SSG] Error fetching client logos:', error);
        
        // Return empty array instead of throwing to prevent build failures
        cachedClientLogos = [];
        return cachedClientLogos;
    }
}

export function getClientLogosByNames(clientNames: string[], allClientLogos: ClientLogo[]): ClientLogo[] {
    const results: ClientLogo[] = [];
    
    for (const clientName of clientNames) {
        // Try exact label match first
        let match = allClientLogos.find(client => client.label === clientName);
        
        // Try case-insensitive label match
        if (!match) {
            match = allClientLogos.find(client => 
                client.label.toLowerCase() === clientName.toLowerCase()
            );
        }
        
        if (match) {
            results.push(match);
        }
    }
    
    return results;
} 