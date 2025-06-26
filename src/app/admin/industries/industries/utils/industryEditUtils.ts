import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/firebase/firebaseconfig';
import { IndustryFormData } from '../types';

// Transform Firestore document data to form data structure
const transformFirestoreToFormData = (firestoreData: any): IndustryFormData => {
    return {
        // Industry Details
        industryName: firestoreData.industryName || "",
        industryOverview: firestoreData.industryOverview || "",
        industryDescription: firestoreData.industryDescription || "",
        industryBriefDescription: firestoreData.industryBriefDescription || "",
        industryHeadline: firestoreData.industryHeadline || "",
        
        // Tags
        globalTags: Array.isArray(firestoreData.globalTags) ? firestoreData.globalTags : [],
        
        // Files - Set to null, show existing as links
        industryIcon: null,
        industryImage: null,
        industryBrochureFile: null,
        industryDatasheetFile: null,
        industryCaseStudyFile: null,
        
        // Existing URLs for display
        industryIconUrl: firestoreData.industryIconUrl || "",
        industryImageUrl: firestoreData.industryImageUrl || "",
        brochureUrl: firestoreData.brochureUrl || "",
        datasheetUrl: firestoreData.datasheetUrl || "",
        caseStudyUrl: firestoreData.caseStudyUrl || "",
        
        // Dynamic sections with proper type checking
        industryStatistics: Array.isArray(firestoreData.industryStatistics) 
            ? firestoreData.industryStatistics.map((stat: any) => ({
                id: stat.id || String(Math.random()),
                value: stat.value || "",
                description: stat.description || ""
            }))
            : [{ id: "1", value: "", description: "" }],
            
        industryFeatures: Array.isArray(firestoreData.industryFeatures)
            ? firestoreData.industryFeatures.map((feature: any) => ({
                id: feature.id || String(Math.random()),
                description: feature.description || "",
                icon: feature.icon || ""
            }))
            : [{ id: "1", description: "", icon: "" }],
            
        industryLeaders: Array.isArray(firestoreData.industryLeaders) 
            ? firestoreData.industryLeaders 
            : [],
        
        // Legacy fields with proper fallbacks
        industryStats: firestoreData.industryStats || [],
        industryBrief: firestoreData.industryBrief || "",
        industryKeyFeatures: firestoreData.industryKeyFeatures || [],
        associatedCompanies: firestoreData.associatedCompanies || [],
        industryBrochure: null,
        industryCaseStudy: null,
        
        // Metadata
        slug: firestoreData.slug || "",
        
        // Additional metadata fields
        createdAt: firestoreData.createdAt || null,
        updatedAt: firestoreData.updatedAt || null,
        createdBy: firestoreData.createdBy || "",
        updatedBy: firestoreData.updatedBy || "",
        createdById: firestoreData.createdById || "",
        updatedById: firestoreData.updatedById || "",
        isDraft: firestoreData.isDraft || false
    };
};

export async function getIndustryForEdit(documentId: string): Promise<IndustryFormData | null> {
    try {
        const db = getFirebaseDb();
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        
        const docRef = doc(db, 'industries', documentId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            console.error(`Industry with ID ${documentId} not found`);
            return null;
        }
        
        const firestoreData = docSnap.data();
        return transformFirestoreToFormData(firestoreData);
    } catch (error) {
        console.error('Error loading industry for edit:', error);
        throw new Error(`Failed to load industry: ${documentId}`);
    }
} 