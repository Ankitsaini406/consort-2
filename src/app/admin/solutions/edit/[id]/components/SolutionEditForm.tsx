import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppFormRenderer } from '@/app/admin/forms/components/AppFormRenderer';
import { solutionFormConfig } from '../../../form/config/solutionFormConfig';
import { SolutionFormData, ContentSection } from '../../../types';
import { StepProgress } from '@/app/admin/forms/components/shared/layout/StepProgress';
import { StepCard } from '@/app/admin/forms/components/shared/layout/StepCard';
import { UniversalFormActions } from '@/app/admin/forms/components/shared/layout/UniversalFormActions';
import { doc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/firebase/firebaseconfig';
import { FormErrorHandler, UserNotification } from '@/app/admin/forms/utils/errorHandler';
import { RateLimiter, withRateLimit } from '@/app/admin/forms/utils/rateLimiter';
import { useUser } from '@/context/userContext';
import { removeFileObjects, uploadDoc } from '@/firebase/firebaseAuth';
import { useTags } from '@/context/TagContext';
import { getSolutionForEdit } from '../../../utils/solutionEditUtils';
import { SolutionSlotUploader, GenericSlotUploader } from '@/app/admin/forms/utils/slotBasedUpload';

interface SolutionEditFormProps {
    documentId: string;
}

export const SolutionEditForm: React.FC<SolutionEditFormProps> = ({ documentId }) => {
    const [originalData, setOriginalData] = useState<SolutionFormData | null>(null);
    const router = useRouter();
    const { globalTags, clientTags, industryTags } = useTags();
    const { email } = useUser();
    const clientId = 'client_9dwo3x'; // TODO: Generate this dynamically
    const context = 'SolutionEditForm';

    useEffect(() => {
        const loadSolution = async () => {
            try {
                const data = await getSolutionForEdit(documentId);
                setOriginalData(data);
            } catch (error) {
                console.error('Error loading solution:', error);
                UserNotification.showError('Failed to load solution data');
            }
        };

        loadSolution();
    }, [documentId]);

    const handleSubmit = async (data: SolutionFormData, isDraft: boolean = false) => {
        try {
            await withRateLimit(clientId, 'formSubmission', async () => {
                // Get Firestore instance
                const db = getFirebaseDb();
                if (!db) {
                    throw new Error('Firestore not initialized');
                }

                // Sanitize input data
                const sanitizedData = {
                    ...data,
                    // Add any necessary sanitization here
                };

                // Upload hero image if provided
                let heroImageUrl: string | null = null;
                if (sanitizedData.heroImage instanceof File) {
                    heroImageUrl = await uploadDoc(`solutions/${documentId}/hero/${sanitizedData.heroImage.name}`, sanitizedData.heroImage);
                }

                // Upload brochure if provided
                let solutionBrochureUrl: string | null = null;
                if (sanitizedData.solutionBrochure instanceof File) {
                    solutionBrochureUrl = await uploadDoc(`solutions/${documentId}/brochure/${sanitizedData.solutionBrochure.name}`, sanitizedData.solutionBrochure);
                }

                // Process content sections
                const updatedSections = await Promise.all(
                    (sanitizedData.contentSections || []).map(async (section: ContentSection, index: number) => {
                        let sectionImageUrl: string | null = null;
                        if (section.image instanceof File) {
                            const imageName = section.image.name.replace(/\s+/g, '_');
                            sectionImageUrl = await uploadDoc(`solutions/${documentId}/sections/${index}_${imageName}`, section.image);
                        } else if (typeof section.image === 'string') {
                            sectionImageUrl = section.image;
                        }

                        return {
                            ...section,
                            sectionImage: sectionImageUrl,
                        };
                    })
                );

                const dataToUpload = {
                    ...sanitizedData,
                    isDraft: isDraft || false,
                    heroImage: heroImageUrl || sanitizedData.heroImage,
                    brochureUrl: solutionBrochureUrl || sanitizedData.brochureUrl,
                    contentSections: updatedSections,
                    updatedAt: new Date(),
                    updatedBy: email || 'Unknown',
                };

                const cleanData = removeFileObjects(dataToUpload);
                console.log(`[${context}] Clean data:`, cleanData);
                await updateDoc(doc(db, 'solutions', documentId), cleanData);

                UserNotification.showSuccess(`Solution "${sanitizedData.solutionName}" updated successfully`);
                console.log(`[${context}] Update successful:`, { docId: documentId });
            });
        } catch (error) {
            FormErrorHandler.logError(error, context);
            UserNotification.showError('Invalid data provided. Please check your input.');
            throw error;
        }
    };

    if (!originalData) {
        return <div>Loading...</div>;
    }

    return (
        <div className="w-full max-w-7xl mx-auto">
            <AppFormRenderer<SolutionFormData>
                formConfig={{
                    ...solutionFormConfig(globalTags, clientTags, industryTags),
                    onSubmit: handleSubmit
                }}
                initialData={originalData}
                StepProgressComponent={StepProgress}
                StepCardComponent={StepCard}
                FormActionsComponent={UniversalFormActions}
            />
        </div>
    );
}; 