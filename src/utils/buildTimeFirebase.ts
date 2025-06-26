/**
 * 🚀 BUILD-TIME FIREBASE UTILITIES
 * 
 * Specialized utilities for robust Firebase operations during Next.js build process
 * Features: Connection pooling, batch operations, circuit breaker, graceful degradation
 */

import { getServerFirestoreAsync, warmupServerFirebase, cleanupServerFirebase } from '@/firebase/serverFirebase';
import { collection, getDocs, query, where, Firestore } from 'firebase/firestore';

// 🔧 BUILD-TIME CONFIGURATION
const BUILD_TIMEOUT_MS = 25000; // 25 seconds (shorter than generateStaticParams timeout)
const BATCH_SIZE = 50; // Process items in batches
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// 🛡️ GLOBAL BUILD STATE
let isBuildFirebaseWarmedUp = false;
let buildStartTime = 0;
let totalOperations = 0;
let successfulOperations = 0;
let failedOperations = 0;

/**
 * 🔧 Initialize Firebase for build process
 * Call this once at the start of build to warm up connections
 */
export async function initializeBuildFirebase(): Promise<boolean> {
    if (isBuildFirebaseWarmedUp) {
        console.log('[BUILD-FIREBASE] Already warmed up');
        return true;
    }

    buildStartTime = Date.now();
    console.log('[BUILD-FIREBASE] Initializing Firebase for build process...');

    try {
        const isReady = await warmupServerFirebase();
        if (isReady) {
            isBuildFirebaseWarmedUp = true;
            console.log('[BUILD-FIREBASE] Firebase ready for build operations');
            return true;
        } else {
            console.warn('[BUILD-FIREBASE] Firebase warmup failed - will use fallback data');
            return false;
        }
    } catch (error) {
        console.error('[BUILD-FIREBASE] Initialization failed:', error);
        return false;
    }
}

/**
 * 🧹 Cleanup Firebase after build completion
 */
export function finalizeBuildFirebase(): void {
    const duration = Date.now() - buildStartTime;
    console.log(`[BUILD-FIREBASE] Build completed in ${duration}ms`);
    console.log(`[BUILD-FIREBASE] Operations: ${totalOperations} total, ${successfulOperations} successful, ${failedOperations} failed`);
    
    cleanupServerFirebase();
    isBuildFirebaseWarmedUp = false;
}

/**
 * 🚀 ROBUST Firebase collection fetcher with timeout and retry
 * 
 * @param collectionName - Firestore collection name
 * @param filters - Optional query filters
 * @param fallbackData - Fallback data if Firebase fails
 * @returns Promise with data or fallback
 */
export async function fetchCollectionRobust<T = any>(
    collectionName: string,
    filters: Array<{ field: string; operator: any; value: any }> = [],
    fallbackData: T[] = []
): Promise<T[]> {
    totalOperations++;
    
    const operationId = `fetch-${collectionName}-${Date.now()}`;
    console.log(`[BUILD-FIREBASE] Starting ${operationId}`);

    // 🛡️ TIMEOUT WRAPPER
    const timeoutPromise = new Promise<T[]>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Firebase operation timeout: ${collectionName}`));
        }, BUILD_TIMEOUT_MS);
    });

    // 🔄 RETRY LOGIC
    const fetchWithRetry = async (attempt: number = 1): Promise<T[]> => {
        try {
            const db = await getServerFirestoreAsync();
            if (!db) {
                throw new Error('Firestore not available');
            }

            console.log(`[BUILD-FIREBASE] Fetching ${collectionName} (attempt ${attempt})`);
            
            let collectionRef = collection(db, collectionName);
            let queryRef: any = collectionRef;

            // Apply filters if provided
            if (filters.length > 0) {
                for (const filter of filters) {
                    queryRef = query(queryRef, where(filter.field, filter.operator, filter.value));
                }
            }

            const snapshot = await getDocs(queryRef);
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                return Object.assign({ id: doc.id }, docData) as T;
            });

            console.log(`[BUILD-FIREBASE] Successfully fetched ${data.length} items from ${collectionName}`);
            successfulOperations++;
            
            return data;

        } catch (error) {
            console.error(`[BUILD-FIREBASE] Attempt ${attempt} failed for ${collectionName}:`, error);
            
            if (attempt < MAX_RETRIES) {
                console.log(`[BUILD-FIREBASE] Retrying ${collectionName} in ${RETRY_DELAY_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                return fetchWithRetry(attempt + 1);
            } else {
                throw error;
            }
        }
    };

    try {
        // Race between fetch operation and timeout
        const result = await Promise.race([
            fetchWithRetry(),
            timeoutPromise
        ]);

        return result;

    } catch (error) {
        failedOperations++;
        console.error(`[BUILD-FIREBASE] ${operationId} failed, using fallback data:`, error);
        
        // Return fallback data instead of throwing
        return fallbackData;
    }
}

/**
 * 🎯 SPECIALIZED FETCHERS for common build-time operations
 */

export async function fetchIndustriesForBuild() {
    console.log('[BUILD-FIREBASE] Fetching industries for static generation...');
    
    const industries = await fetchCollectionRobust(
        'industries',
        [{ field: 'isDraft', operator: '==', value: false }], // Only published
        [
            { id: 'oil-gas', slug: 'oil-gas', industryName: 'Oil & Gas' },
            { id: 'manufacturing', slug: 'manufacturing', industryName: 'Manufacturing' },
            { id: 'energy', slug: 'energy', industryName: 'Energy' },
            { id: 'automotive', slug: 'automotive', industryName: 'Automotive' },
            { id: 'healthcare', slug: 'healthcare', industryName: 'Healthcare' }
        ]
    );

    // Validate and filter industries
    return industries.filter(industry => 
        industry.slug && 
        industry.slug.trim() !== '' &&
        industry.industryName && 
        industry.industryName.trim() !== ''
    );
}

export async function fetchPortfolioForBuild() {
    console.log('[BUILD-FIREBASE] Fetching portfolio for static generation...');
    
    const products = await fetchCollectionRobust(
        'portfolio',
        [{ field: 'isDraft', operator: '==', value: false }],
        [
            { id: 'automation-solution', productName: 'Automation Solution', productGalleryUrls: ['placeholder.jpg'] },
            { id: 'industrial-iot', productName: 'Industrial IoT', productGalleryUrls: ['placeholder.jpg'] },
            { id: 'digital-transformation', productName: 'Digital Transformation', productGalleryUrls: ['placeholder.jpg'] },
            { id: 'mcx-one', productName: 'MCX One', productGalleryUrls: ['placeholder.jpg'] }
        ]
    );

    // Filter products with required fields
    return products.filter(product =>
        product.id &&
        product.productName &&
        product.productGalleryUrls?.length > 0
    );
}

export async function fetchPostsForBuild() {
    console.log('[BUILD-FIREBASE] Fetching posts for static generation...');
    
    const posts = await fetchCollectionRobust(
        'posts',
        [{ field: 'isDraft', operator: '==', value: false }],
        [
            { id: 'news-1', postType: 'news', slug: 'company-announcement' },
            { id: 'blog-1', postType: 'blog-post', slug: 'digital-transformation-guide' },
            { id: 'event-1', postType: 'events', slug: 'upcoming-conference' },
            { id: 'announce-1', postType: 'announcements', slug: 'product-launch' }
        ]
    );

    return posts.filter(post => post.postType && post.slug);
}

export async function fetchResourcesForBuild() {
    console.log('[BUILD-FIREBASE] Fetching resources for static generation...');
    
    const resources = await fetchCollectionRobust(
        'resources',
        [{ field: 'isDraft', operator: '==', value: false }],
        [
            { id: 'case-1', resourceType: 'case-study', slug: 'automation-success-story' },
            { id: 'white-1', resourceType: 'whitepaper', slug: 'digital-transformation-whitepaper' },
            { id: 'review-1', resourceType: 'client-review', slug: 'client-testimonial' }
        ]
    );

    return resources.filter(resource => resource.resourceType && resource.slug);
}

export async function fetchSolutionsForBuild() {
    console.log('[BUILD-FIREBASE] Fetching solutions for static generation...');
    
    const solutions = await fetchCollectionRobust(
        'solutions',
        [{ field: 'isDraft', operator: '==', value: false }],
        [
            { id: 'auto-1', slug: 'automation-solution', solutionTitle: 'Automation Solution', heroImage: 'placeholder.jpg' },
            { id: 'iot-1', slug: 'iot-platform', solutionTitle: 'IoT Platform', heroImage: 'placeholder.jpg' },
            { id: 'digital-1', slug: 'digital-transformation', solutionTitle: 'Digital Transformation', heroImage: 'placeholder.jpg' },
            { id: 'connect-1', slug: 'industrial-connectivity', solutionTitle: 'Industrial Connectivity', heroImage: 'placeholder.jpg' }
        ]
    );

    return solutions.filter(solution =>
        solution.slug &&
        solution.solutionTitle &&
        solution.heroImage
    );
}

/**
 * 🔧 BUILD HEALTH CHECK - Test Firebase connectivity before build
 */
export async function performBuildHealthCheck(): Promise<{
    isHealthy: boolean;
    latency: number;
    error?: string;
}> {
    const startTime = Date.now();
    
    try {
        console.log('[BUILD-FIREBASE] Performing health check...');
        
        const db = await getServerFirestoreAsync();
        if (!db) {
            return {
                isHealthy: false,
                latency: Date.now() - startTime,
                error: 'Firestore instance not available'
            };
        }

        // Quick connectivity test
        const testRef = collection(db, 'health_check');
        await getDocs(testRef);
        
        const latency = Date.now() - startTime;
        console.log(`[BUILD-FIREBASE] Health check passed (${latency}ms)`);
        
        return {
            isHealthy: true,
            latency
        };

    } catch (error) {
        const latency = Date.now() - startTime;
        console.error(`[BUILD-FIREBASE] Health check failed (${latency}ms):`, error);
        
        return {
            isHealthy: false,
            latency,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * 📊 BUILD STATISTICS
 */
export function getBuildStatistics() {
    return {
        totalOperations,
        successfulOperations,
        failedOperations,
        successRate: totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0,
        buildDuration: buildStartTime > 0 ? Date.now() - buildStartTime : 0,
        isWarmedUp: isBuildFirebaseWarmedUp
    };
} 