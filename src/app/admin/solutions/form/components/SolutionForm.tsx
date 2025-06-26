import React from 'react';
import { useRouter } from 'next/navigation';
import { AppFormRenderer } from '@/app/admin/forms/components/AppFormRenderer';
import { solutionFormConfig } from '../config/solutionFormConfig';
import { SolutionFormData, ContentSection } from '../../types';
import { StepProgress } from '@/app/admin/forms/components/shared/layout/StepProgress';
import { StepCard } from '@/app/admin/forms/components/shared/layout/StepCard';
import { UniversalFormActions } from '@/app/admin/forms/components/shared/layout/UniversalFormActions';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/firebase/firebaseconfig';
import { FormErrorHandler, UserNotification } from '@/app/admin/forms/utils/errorHandler';
import { RateLimiter, withRateLimit } from '@/app/admin/forms/utils/rateLimiter';
import { useUser } from '@/context/userContext';
import { createSlug } from '@/utils/Utils';
import { removeFileObjects, uploadDoc } from '@/firebase/firebaseAuth';
import { useTags } from '@/context/TagContext';

export const SolutionForm: React.FC = () => {
    const { globalTags, clientTags, industryTags } = useTags();
    const { email } = useUser();
    const clientId = 'client_9dwo3x'; // TODO: Generate this dynamically
    const context = 'SolutionForm';

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

                // Create slug from solution name
                const slug = createSlug(sanitizedData.solutionName);

                // Upload hero image if provided
                let heroImageUrl: string | null = null;
                if (sanitizedData.heroImage instanceof File) {
                    heroImageUrl = await uploadDoc(`solutions/${slug}/hero/${sanitizedData.heroImage.name}`, sanitizedData.heroImage);
                }

                // Upload brochure if provided
                let solutionBrochureUrl: string | null = null;
                if (sanitizedData.solutionBrochure instanceof File) {
                    solutionBrochureUrl = await uploadDoc(`solutions/${slug}/brochure/${sanitizedData.solutionBrochure.name}`, sanitizedData.solutionBrochure);
                }

                // Process content sections
                const updatedSections = await Promise.all(
                    (sanitizedData.contentSections || []).map(async (section: ContentSection, index: number) => {
                        let sectionImageUrl: string | null = null;
                        if (section.image instanceof File) {
                            const imageName = section.image.name.replace(/\s+/g, '_');
                            sectionImageUrl = await uploadDoc(`solutions/${slug}/sections/${index}_${imageName}`, section.image);
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
                    slug,
                    isDraft: isDraft || false,
                    heroImage: heroImageUrl || null,
                    brochureUrl: solutionBrochureUrl || null,
                    contentSections: updatedSections,
                    createdBy: email || 'Unknown',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    updatedBy: email || 'Unknown',
                };

                const cleanData = removeFileObjects(dataToUpload);
                console.log(`[${context}] Clean data:`, cleanData);
                await setDoc(doc(db, 'solutions', slug), cleanData);

                UserNotification.showSuccess(`Solution "${sanitizedData.solutionName}" saved successfully with ID: ${slug}`);
                console.log(`[${context}] Submit successful:`, { docId: slug });
            });
        } catch (error) {
            FormErrorHandler.logError(error, context);
            UserNotification.showError('Invalid data provided. Please check your input.');
            throw error;
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto">
            <AppFormRenderer<SolutionFormData>
                formConfig={{
                    ...solutionFormConfig(globalTags, clientTags, industryTags),
                    onSubmit: handleSubmit
                }}
                StepProgressComponent={StepProgress}
                StepCardComponent={StepCard}
                FormActionsComponent={UniversalFormActions}
            />
        </div>
    );
};
