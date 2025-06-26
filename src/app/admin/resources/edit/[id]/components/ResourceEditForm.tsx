import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppFormRenderer } from '@/app/admin/forms/components/AppFormRenderer';
import { ResourceFormData, ResourceSectionItem } from '../../../types';
import { StepProgress } from '@/app/admin/forms/components/shared/layout/StepProgress';
import { StepCard } from '@/app/admin/forms/components/shared/layout/StepCard';
import { UniversalFormActions } from '@/app/admin/forms/components/shared/layout/UniversalFormActions';
import { doc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/firebase/firebaseconfig';
import { uploadDoc } from '@/firebase/firebaseAuth';
import { FormErrorHandler, UserNotification, InputSanitizer } from '@/app/admin/forms/utils/errorHandler';
import { RateLimiter, withRateLimit } from '@/app/admin/forms/utils/rateLimiter';
import { useTags } from '@/context/TagContext';
import { useUser } from '@/context/userContext';
import { GenericSlotUploader, SLOT_CONFIGS } from '@/app/admin/forms/utils/slotBasedUpload';

import { resourceFormConfig } from '../../../form/config/resourceFormConfig';
import { getResourceForEdit } from '../../../utils/resourceEditUtils';
import { optimizeHeroImageSafe, optimizeSectionImages } from '@/utils/imageOptimizer';

interface ResourceEditFormProps {
    documentId: string;
}

interface UploadResult {
    type: 'hero' | 'resource';
    url: string;
}

const sanitizeResourceData = (data: ResourceFormData): ResourceFormData => {
    // Convert sections to array if it's an object (happens with dynamic form fields)
    let sectionsArray: ResourceSectionItem[] = [];
    if (data.sections) {
        if (Array.isArray(data.sections)) {
            sectionsArray = data.sections;
        } else if (typeof data.sections === 'object' && data.sections !== null) {
            // Convert object with numeric keys to array
            const sectionsObject = data.sections as Record<string, ResourceSectionItem>;
            sectionsArray = Object.keys(sectionsObject)
                .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
                .map(key => sectionsObject[key])
                .filter(section => section && typeof section === 'object'); // Filter out any invalid entries
        }
    }

    return {
        ...data,
        resourceTitle: InputSanitizer.sanitizeString(data.resourceTitle || ''),
        headline: InputSanitizer.sanitizeHTML(data.headline || ''),
        // Sanitize resource sections
        sections: sectionsArray.map(section => ({
            ...section,
            sectionTitle: InputSanitizer.sanitizeString(section.sectionTitle || ''),
            sectionContent: InputSanitizer.sanitizeHTML(section.sectionContent || ''),
        })),
    };
};

const handleResourceEditSubmit = async (
    user: any, 
    data: ResourceFormData, 
    documentId: string,
    originalData: ResourceFormData,
    isDraft?: boolean,
    router?: any
) => {
    const context = 'ResourceEditForm';
    const clientId = RateLimiter.getClientIdentifier();
    
    try {
        await withRateLimit(clientId, 'formSubmission', async () => {
            const db = getFirebaseDb();
            if (!db) {
                throw new Error('Firestore not initialized');
            }

            console.log(`[${context}] Edit submit started:`, { isDraft, documentId });

            // Validate required fields
            if (!data.resourceTitle) {
                throw new Error('Resource title is required');
            }

            // Validate user
            if (!user || (!user.uid && !user.id) || !user.email) {
                throw new Error('User not authenticated');
            }

            // Get the resource slug for custom naming
            const resourceSlug = originalData.slug || documentId;
            
            // Optimize hero image if new one uploaded
            let heroImageUrl: string | null = typeof originalData.heroImageUrl === 'string' ? originalData.heroImageUrl : null;
            if (data.heroImage instanceof File) {
                console.log(`🖼️ Optimizing hero image to 940px + 320px...`);
                const { optimized, original } = await optimizeHeroImageSafe(data.heroImage);
                const finalHeroFiles = [...optimized, ...original];
                
                if (finalHeroFiles.length >= 2) {
                    const mainFile = finalHeroFiles.find(f => f.name.includes('-940.webp')) || finalHeroFiles[0];
                    const thumbnailFile = finalHeroFiles.find(f => f.name.includes('-320.webp'));
                    
                    const uploadedUrl = await GenericSlotUploader.uploadSingleFile(
                        mainFile,
                        'resources',
                        documentId,
                        'hero',
                        resourceSlug
                    );
                    heroImageUrl = typeof uploadedUrl === 'string' ? uploadedUrl : null;
                    
                    if (thumbnailFile) {
                        await GenericSlotUploader.uploadSingleFile(
                            thumbnailFile,
                            'resources',
                            documentId,
                            'hero-thumb',
                            resourceSlug
                        );
                    }
                } else {
                    const uploadedUrl = await GenericSlotUploader.uploadSingleFile(
                        finalHeroFiles[0],
                        'resources',
                        documentId,
                        'hero',
                        resourceSlug
                    );
                    heroImageUrl = typeof uploadedUrl === 'string' ? uploadedUrl : null;
                }
            }

            // Handle resource file if new one uploaded
            let resourceFileUrl: string | null = typeof originalData.resourceFileUrl === 'string' ? originalData.resourceFileUrl : null;
            if (data.resourceFile instanceof File) {
                const uploadedUrl = await GenericSlotUploader.uploadSingleFile(
                    data.resourceFile,
                    'resources',
                    documentId,
                    'file',
                    resourceSlug
                );
                resourceFileUrl = typeof uploadedUrl === 'string' ? uploadedUrl : null;
            }

            // Prepare update data - ensure no undefined values
            const updateData = {
                resourceType: data.resourceType || '',
                resourceTitle: data.resourceTitle || '',
                headline: data.headline || '',
                globalTags: data.globalTags || [],
                clientCompanies: data.clientCompanies || [],
                industryUseCases: data.industryUseCases || [],
                heroImageUrl,
                resourceFileUrl,
                isDraft: !!isDraft,
                updatedBy: user.email || 'Unknown',
                updatedAt: new Date(),
            };

            console.log(`[${context}] Updating resource:`, { documentId });
            await updateDoc(doc(db, "resources", documentId), updateData);

            UserNotification.showSuccess(`Resource "${updateData.resourceTitle}" updated successfully!`);
            console.log(`[${context}] Edit successful:`, { docId: documentId });

            // Trigger ISR revalidation
            try {
                const { triggerRevalidation, getResourceRevalidationPaths } = await import('@/lib/revalidation-helper');
                const pathsToRevalidate = getResourceRevalidationPaths(data.resourceType, documentId);
                await triggerRevalidation(pathsToRevalidate);
                console.log(`[${context}] Revalidation triggered for paths:`, pathsToRevalidate);
            } catch (revalidationError) {
                console.warn(`[${context}] Revalidation failed (content still updated):`, revalidationError);
            }
            
            // Redirect to resources list after successful update
            if (router) {
                setTimeout(() => {
                    router.push('/admin/list-details?type=resources');
                }, 1500);
            }
        });
    } catch (error) {
        console.error(`[${context}] Error occurred:`, error);
        const formError = FormErrorHandler.handleError(error);
        FormErrorHandler.logError(error, context);
        UserNotification.showError(formError);
        throw error;
    }
};

// Resource-specific FormActions wrapper
const ResourceEditFormActions: React.FC<React.ComponentProps<typeof UniversalFormActions>> = (props) => (
    <UniversalFormActions {...props} submitText="Update Resource" />
);

export const ResourceEditForm: React.FC<ResourceEditFormProps> = ({ documentId }) => {
    const router = useRouter();
    const { user } = useUser();
    const { globalTags, clientTags, industryTags, loading, error } = useTags();
    const [initialData, setInitialData] = useState<ResourceFormData | null>(null);
    const [originalData, setOriginalData] = useState<ResourceFormData | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        const loadResourceData = async () => {
            try {
                setIsLoadingData(true);
                const resourceData = await getResourceForEdit(documentId);
                if (resourceData) {
                    setInitialData(resourceData);
                    setOriginalData(resourceData);
                } else {
                    setLoadError('Resource not found');
                }
            } catch (error) {
                console.error('Failed to load resource:', error);
                setLoadError(error instanceof Error ? error.message : 'Failed to load resource');
            } finally {
                setIsLoadingData(false);
            }
        };

        if (documentId) {
            loadResourceData();
        }
    }, [documentId]);

    const onSubmitWithUser = async (data: ResourceFormData, isDraft?: boolean) => {
        if (!originalData) return;
        await handleResourceEditSubmit(user, data, documentId, originalData, isDraft, router);
    };

    if (loading || isLoadingData) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error loading form configuration: {error.message}</div>;
    }

    if (loadError) {
        return <div>Error loading resource: {loadError}</div>;
    }

    if (!initialData || !originalData) {
        return <div>Resource not found.</div>;
    }

    // SMART VALIDATION APPROACH: Keep business logic intact, enhance validation intelligence
    const baseConfig = resourceFormConfig(globalTags, clientTags, industryTags);
    const configWithActualSubmit = {
        ...baseConfig,
        formTitle: 'Edit Resource',
        description: 'Update the resource details below.',
        onSubmit: onSubmitWithUser,
        steps: baseConfig.steps.map(step => ({
            ...step,
            fields: step.fields.map(field => {
                // Enhanced validation for file fields in edit mode - smart about existing files
                if (field.id === 'heroImage' && field.validation?.required) {
                    return {
                        ...field,
                        validation: {
                            ...field.validation,
                            // CRITICAL: Set required to false so our custom validation runs
                            required: false,
                            // Custom validation that handles BOTH required logic AND existing files
                            custom: (value: any, formData?: Record<string, unknown>) => {
                                console.log('[ResourceEditForm] Custom validation debug:', {
                                    fieldId: field.id,
                                    value: value,
                                    valueType: typeof value,
                                    isFile: value instanceof File,
                                    heroImageUrl: formData ? (formData as any)?.heroImageUrl : undefined,
                                    initialDataHeroImageUrl: initialData?.heroImageUrl,
                                    formDataKeys: formData ? Object.keys(formData) : []
                                });
                                
                                // If user uploaded a new file, it's valid
                                if (value && value instanceof File) {
                                    console.log('[ResourceEditForm] Validation passed: new file uploaded');
                                    return undefined; // No error
                                }
                                
                                // Check for existing image URL in form data first
                                const existingUrl = formData ? (formData as any)?.heroImageUrl : undefined;
                                if (existingUrl && typeof existingUrl === 'string' && existingUrl.trim()) {
                                    console.log('[ResourceEditForm] Validation passed: existing URL found in formData:', existingUrl);
                                    return undefined; // No error
                                }
                                
                                // Fallback: check initial data (in case formData isn't fully populated yet)
                                const initialUrl = initialData?.heroImageUrl;
                                if (initialUrl && typeof initialUrl === 'string' && initialUrl.trim()) {
                                    console.log('[ResourceEditForm] Validation passed: existing URL found in initialData:', initialUrl);
                                    return undefined; // No error
                                }
                                
                                // Neither new file nor existing URL - invalid (this handles the required logic)
                                console.log('[ResourceEditForm] Validation failed: no file or existing URL');
                                return `${field.label} is required.`;
                            }
                        }
                    };
                }
                return field;
            })
        }))
    };

    return (
        <AppFormRenderer<ResourceFormData>
            formConfig={configWithActualSubmit}
            initialData={initialData}
            StepProgressComponent={StepProgress}
            StepCardComponent={StepCard}
            FormActionsComponent={ResourceEditFormActions}
        />
    );
}; 