import React, { useState } from 'react';
import { Button3 } from "@/ui/components/Button3";
import { useRouter } from 'next/navigation';

interface UniversalFormActionsProps {
    currentStep: number;
    totalSteps: number;
    isSubmitting: boolean;
    isCurrentStepValid: boolean;
    onPrevious: () => void;
    onNext: () => void;
    onSubmit: (isDraft?: boolean) => void;
    submitText?: string; // Customizable submit button text
    redirectPath?: string; // Where to redirect after successful submission
}

export const UniversalFormActions: React.FC<UniversalFormActionsProps> = ({ 
    currentStep, 
    totalSteps, 
    onPrevious, 
    onNext, 
    onSubmit, 
    isSubmitting, 
    isCurrentStepValid,
    submitText = "Submit", // Default text
    redirectPath // Pass this to the form handlers
}) => {
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleSubmit = async (isDraft?: boolean) => {
        try {
            await onSubmit(isDraft);
            // Only redirect if submission was successful
            if (redirectPath) {
                setIsRedirecting(true);
                // Add a small delay to allow the success message to be shown
                setTimeout(() => {
                    router.push(redirectPath);
                }, 1500);
            }
        } catch (error) {
            // Error is already handled by useAppForm
            console.error('Form submission error:', error);
            setIsRedirecting(false);
        }
    };

    return (
        <div className="flex justify-between pt-6 mt-auto border-t border-neutral-border flex-shrink-0">
            <Button3
                variant="neutral-tertiary"
                onClick={onPrevious}
                disabled={currentStep === 0 || isSubmitting || isRedirecting}
            >
                Previous
            </Button3>

            {currentStep < totalSteps - 1 ? (
                <Button3
                    variant="brand-primary"
                    onClick={onNext}
                    disabled={isSubmitting || !isCurrentStepValid || isRedirecting}
                >
                    Next
                </Button3>
            ) : (
                <Button3
                    variant="brand-primary"
                    onClick={() => handleSubmit()} 
                    disabled={isSubmitting || !isCurrentStepValid || isRedirecting}
                >
                    {isSubmitting ? 'Submitting...' : isRedirecting ? 'Redirecting...' : submitText}
                </Button3>
            )}
        </div>
    );
}; 