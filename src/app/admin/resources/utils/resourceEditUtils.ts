import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/firebase/firebaseconfig';
import { ResourceFormData, ResourceSectionItem } from '../types';

// Transform Firestore document data to form data structure
const transformFirestoreToFormData = (firestoreData: any): ResourceFormData => {
    // Transform sections if they exist
    const sections = Array.isArray(firestoreData.sections) 
        ? firestoreData.sections.map((section: any) => ({
            sectionTitle: section.sectionTitle || "",
            sectionContent: section.sectionContent || "",
            sectionImage: null, // File will be null, we'll show existing URL
            sectionImageUrl: section.sectionImageUrl || section.sectionImage || "",
        }))
        : [];

    return {
        // Resource Details
        resourceType: firestoreData.resourceType || "",
        resourceTitle: firestoreData.resourceTitle || "",
        headline: firestoreData.headline || "",
        globalTags: firestoreData.globalTags || [],
        clientCompanies: firestoreData.clientCompanies || [],
        industryUseCases: firestoreData.industryUseCases || [],
        
        // Files - Set to null, show existing as links
        heroImage: null,
        resourceFile: null,
        
        // Existing URLs for display
        heroImageUrl: firestoreData.heroImageUrl || firestoreData.heroImage || "",
        resourceFileUrl: firestoreData.resourceFileUrl || firestoreData.resourceUrl || "",
        
        // Metadata
        slug: firestoreData.slug || "",
        date: firestoreData.date || new Date().toISOString(),

        // Sections
        sections: sections,
    };
};

export async function getResourceForEdit(documentId: string): Promise<ResourceFormData | null> {
    try {
        const db = getFirebaseDb();
        if (!db) {
            throw new Error('Firestore not initialized');
        }
        
        const docRef = doc(db, 'resources', documentId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            console.error(`Resource with ID ${documentId} not found`);
            return null;
        }
        
        const firestoreData = docSnap.data();
        return transformFirestoreToFormData(firestoreData);
    } catch (error) {
        console.error('Error loading resource for edit:', error);
        throw new Error(`Failed to load resource: ${documentId}`);
    }
} 