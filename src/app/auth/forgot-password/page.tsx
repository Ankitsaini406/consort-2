"use client";

import React, { useState, useEffect } from "react";
import { Button3 } from "@/ui/components/Button3";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { sanitizeEmail, isValidEmail } from "@/utils/inputSanitizer";
import { getFirebaseAuth } from "@/firebase/firebaseconfig";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const router = useRouter();
    
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
    
    // Real-time validation states
    const [emailError, setEmailError] = useState("");
    const [isEmailValid, setIsEmailValid] = useState(false);

    // Rate limiting configuration
    const MAX_RESET_ATTEMPTS = 3;
    const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

    // Check if user is temporarily blocked
    useEffect(() => {
        const checkBlock = () => {
            if (!email) return;
            
            const blockKey = `reset_block_${email}`;
            const blockData = localStorage.getItem(blockKey);
            
            if (blockData) {
                const { blockedUntil } = JSON.parse(blockData);
                const now = Date.now();
                
                if (now < blockedUntil) {
                    setIsBlocked(true);
                    setBlockTimeRemaining(Math.ceil((blockedUntil - now) / 1000));
                    
                    // Update countdown every second
                    const interval = setInterval(() => {
                        const remaining = Math.ceil((blockedUntil - Date.now()) / 1000);
                        if (remaining <= 0) {
                            setIsBlocked(false);
                            setBlockTimeRemaining(0);
                            localStorage.removeItem(blockKey);
                            clearInterval(interval);
                        } else {
                            setBlockTimeRemaining(remaining);
                        }
                    }, 1000);
                    
                    return () => clearInterval(interval);
                } else {
                    // Block expired, remove it
                    localStorage.removeItem(blockKey);
                    setIsBlocked(false);
                    setBlockTimeRemaining(0);
                }
            }
        };
        
        checkBlock();
    }, [email]);

    // Real-time email validation
    const validateEmail = (emailValue: string) => {
        if (!emailValue) {
            setEmailError("");
            setIsEmailValid(false);
            return;
        }
        
        if (!isValidEmail(emailValue)) {
            setEmailError("Please enter a valid email address");
            setIsEmailValid(false);
        } else {
            setEmailError("");
            setIsEmailValid(true);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");

        // Input validation
        if (!email) {
            setMessage("❌ Please enter your email address");
            return;
        }

        if (!isValidEmail(email)) {
            setMessage("❌ Please enter a valid email address");
            return;
        }

        // Check for account block
        if (checkAndUpdateBlock()) {
            const minutes = Math.ceil(blockTimeRemaining / 60);
            setMessage(`❌ Too many attempts. Try again in ${minutes} minute(s)`);
            return;
        }

        setIsSubmitting(true);
        const sanitizedEmail = sanitizeEmail(email);

        try {
            const auth = getFirebaseAuth();
            if (!auth) {
                throw new Error('Firebase Auth not initialized');
            }
            
            // Send password reset email through Firebase
            await sendPasswordResetEmail(auth, sanitizedEmail);
            
            // Clear any existing failed attempts on successful request
            const attemptsKey = `reset_attempts_${email}`;
            const blockKey = `reset_block_${email}`;
            localStorage.removeItem(attemptsKey);
            localStorage.removeItem(blockKey);
            
            setIsSuccess(true);
            setMessage("✅ Password reset email sent! Please check your inbox.");
            
        } catch (error: any) {
            
            // Track failed attempt
            const attemptsKey = `reset_attempts_${email}`;
            const blockKey = `reset_block_${email}`;
            const now = Date.now();
            
            let attempts = [];
            try {
                const storedAttempts = localStorage.getItem(attemptsKey);
                if (storedAttempts) {
                    attempts = JSON.parse(storedAttempts);
                }
            } catch (e) {
                attempts = [];
            }
            
            // Add current attempt
            attempts.push(now);
            
            // Keep only attempts from the last hour
            const oneHourAgo = now - (60 * 60 * 1000);
            attempts = attempts.filter((timestamp: number) => timestamp > oneHourAgo);
            
            // Store updated attempts
            localStorage.setItem(attemptsKey, JSON.stringify(attempts));
            
            // Check if should block
            if (attempts.length >= MAX_RESET_ATTEMPTS) {
                const blockedUntil = now + BLOCK_DURATION;
                localStorage.setItem(blockKey, JSON.stringify({ blockedUntil }));
                setIsBlocked(true);
                setBlockTimeRemaining(Math.ceil(BLOCK_DURATION / 1000));
                
                setMessage(`❌ Too many attempts. Password reset blocked for 15 minutes`);
                setIsSuccess(false);
                return;
            }
            
            // Show remaining attempts warning
            const remainingAttempts = MAX_RESET_ATTEMPTS - attempts.length;
            let errorMessage = "❌ Failed to send reset link";
            
            if (remainingAttempts <= 1 && remainingAttempts > 0) {
                errorMessage += `. ${remainingAttempts} attempt remaining before lockout`;
            }
            
            setMessage(errorMessage);
            setIsSuccess(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isSubmitting && !isBlocked) {
            handleSubmit(e);
        }
    };

    const handleBackToLogin = () => {
        router.push("/auth");
    };

    const checkAndUpdateBlock = () => {
        const blockKey = `reset_block_${email}`;
        const blockData = localStorage.getItem(blockKey);
        
        if (blockData) {
            const { timestamp, duration } = JSON.parse(blockData);
            const now = Date.now();
            const timeElapsed = now - timestamp;
            
            if (timeElapsed < duration) {
                setIsBlocked(true);
                setBlockTimeRemaining(Math.ceil((duration - timeElapsed) / 1000));
                return true;
            } else {
                localStorage.removeItem(blockKey);
                return false;
            }
        }
        return false;
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-gradient-to-t from-brand-50 to-brand-100">
            <div className="flex w-full max-w-xs flex-col items-center gap-8 rounded-lg bg-white py-10 px-10 shadow-md">
                <div className="flex flex-col items-center gap-4 pt-4">
                    <Image
                        src="/logo.svg"
                        alt="Logo"
                        priority={true}
                        width={120}
                        height={32}
                        className="h-5 w-auto"
                    />
                    <div className="flex flex-col items-center gap-4 mt-2">
                        <h1 className="text-body-lg font-heading-2 text-neutral-500">
                            Reset Password
                        </h1>
                        {/* <p className="text-sm text-center text-gray-600 leading-relaxed">
                            A link will be sent to reset your password
                        </p> */}
                    </div>
                </div>

                {/* Message Display */}
                {message && (
                    <div className={`w-full py-3 px-2 rounded-sm text-center ${
                        isSuccess 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                    }`}>
                        <p className={`text-sm ${
                            isSuccess ? 'text-green-600' : 'text-red-600'
                        }`}>
                            {message}
                        </p>
                    </div>
                )}

                <div className="flex w-full flex-col gap-4">
                    <div className="w-full">
                        <Input
                            placeholder="Enter your email address"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                const sanitized = sanitizeEmail(e.target.value);
                                setEmail(sanitized);
                                validateEmail(sanitized);
                            }}
                            onKeyPress={handleKeyPress}
                            disabled={isSubmitting || isBlocked}
                            className={`w-full ${
                                emailError 
                                    ? 'border-red-300 focus:border-red-500' 
                                    : isEmailValid 
                                        ? 'border-green-300 focus:border-green-500' 
                                        : isBlocked 
                                            ? 'border-amber-300 bg-amber-50' 
                                            : ''
                            }`}
                            maxLength={254}
                            autoFocus
                        />
                        {emailError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px]">!</span>
                                {emailError}
                            </p>
                        )}
                        {isEmailValid && !emailError && !isBlocked && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-green-500 text-white flex items-center justify-center text-[8px]">✓</span>
                                Valid email address
                            </p>
                        )}
                        {isBlocked && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px]">⏳</span>
                                Password reset temporarily blocked
                            </p>
                        )}
                    </div>

                    <Button3
                        className="w-full"
                        variant="brand-primary"
                        size="medium"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !email || !!emailError || isSuccess || isBlocked}
                        loading={isSubmitting}
                    >
                        {isBlocked 
                            ? `Blocked (${Math.ceil(blockTimeRemaining / 60)}m)` 
                            : isSuccess 
                                ? "Link Sent" 
                                : "Send Reset Link"
                        }
                    </Button3>

                    <Button3
                        onClick={handleBackToLogin}
                        disabled={isSubmitting}
                        variant="link"
                        size="medium"
                        icon={<ArrowLeft className="w-4 h-4"/>}
                    >
                        Back to Log In
                    </Button3>
                </div>

                <div className="text-center text-xs text-neutral-400">
                    🔒 Secured Authentication
                </div>
            </div>
        </div>
    );
}

