"use client";

import React, { useState, useEffect } from "react";
import { Button3 } from "@/ui/components/Button3";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { sanitizeEmail, sanitizePassword, isValidEmail, isValidPassword } from "@/utils/inputSanitizer";
import { getFirebaseAuth } from "@/firebase/firebaseconfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { AUTH_COOKIE_CONFIG } from "@/utils/authUtils";

export default function AuthPage() {
    const router = useRouter();
    const { user, login, loading, error } = useAuthContext();
    
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [step, setStep] = useState(1); // 1 = email, 2 = password
    const [loginError, setLoginError] = useState("");
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
    
    // Real-time validation states
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [isEmailValid, setIsEmailValid] = useState(false);
    
    // Simple auth state to prevent double-clicks
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Prevent infinite redirect loops
    const [hasRedirected, setHasRedirected] = useState(false);

    // Constants for rate limiting
    const MAX_ATTEMPTS = 5;
    const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

    // Redirect if already authenticated (enhanced logic)
    useEffect(() => {
        // Only redirect if we're actually on the auth page, user is authenticated, and we haven't redirected yet
        if (user && !loading && !hasRedirected && window.location.pathname === '/auth') {
            console.log('[AUTH-PAGE] User authenticated, redirecting...', { email: user.email });
            
            // Ensure we have a valid user before redirecting
            if (user.uid && user.email) {
                // Set flag to prevent multiple redirects
                setHasRedirected(true);
                
                console.log('[AUTH-PAGE] Valid user detected, redirecting immediately to admin');
                
                // Use router.replace to prevent infinite loops
                router.replace("/admin");
            }
        }
    }, [user, loading, hasRedirected, router]);

    // Check if user is temporarily blocked
    useEffect(() => {
        const checkBlock = () => {
            if (!email) return;
            
            const blockKey = `login_block_${email}`;
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

    // Real-time password validation
    const validatePassword = (passwordValue: string) => {
        if (!passwordValue) {
            setPasswordError("");
            return;
        }
        
        const validation = isValidPassword(passwordValue);
        if (!validation.isValid) {
            setPasswordError(validation.message || "Password is required");
        } else {
            setPasswordError("");
        }
    };

    const handleStep1 = () => {
        const sanitizedEmail = sanitizeEmail(email);
        
        if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
            setEmailError("Please enter a valid email address");
            return;
        }
        
        setEmail(sanitizedEmail); // Update state with sanitized email
        setLoginError(""); // Clear any previous auth errors
        setEmailError("");
        setStep(2);
    };

    const handleStep2 = async () => {
        const sanitizedPassword = sanitizePassword(password);
        const passwordValidation = isValidPassword(sanitizedPassword);
        
        if (!passwordValidation.isValid) {
            setPasswordError(passwordValidation.message || "Please enter a valid password");
            return;
        }

        // Check if user is blocked
        if (isBlocked) {
            const minutes = Math.ceil(blockTimeRemaining / 60);
            setLoginError(`Too many failed attempts. Please try again in ${minutes} minute(s).`);
            return;
        }

        try {
            setLoginError("");
            setIsSubmitting(true);
            
            const auth = getFirebaseAuth();
            if (!auth) {
                throw new Error('Firebase Auth not initialized');
            }
            
            console.log('[AUTH-PAGE] Attempting login for:', email);
            
            // Use the login function from context instead of direct Firebase call
            await login(sanitizeEmail(email), sanitizedPassword);
            
            // Success - clear any existing errors
            setLoginError("");
            setPasswordError("");
            
            console.log('[AUTH-PAGE] Login successful, waiting for auth state...');
            
            // Don't reset loading state immediately - let the redirect happen first
            
            // Keep button disabled until redirect or timeout
            // Check if user is authenticated after a short delay
            setTimeout(() => {
                // Only re-enable form if we're still on the auth page and not authenticated
                if (window.location.pathname === '/auth' && !user) {
                    setIsSubmitting(false);
                    console.log('[AUTH-PAGE] Auth state not updated after login, enabling form...');
                }
            }, 2000); // Reduced timeout to 2 seconds
            
        } catch (error: any) {
            console.error('[AUTH-PAGE] Login error:', error);
            
            // Track failed attempt
            const attemptsKey = `login_attempts_${email}`;
            const blockKey = `login_block_${email}`;
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
            if (attempts.length >= MAX_ATTEMPTS) {
                const blockedUntil = now + BLOCK_DURATION;
                localStorage.setItem(blockKey, JSON.stringify({ blockedUntil }));
                setIsBlocked(true);
                setBlockTimeRemaining(Math.ceil(BLOCK_DURATION / 1000));
                
                setLoginError(`Too many failed attempts. Account temporarily locked for 15 minutes.`);
                setIsSubmitting(false);
                return;
            }
            
            // Handle specific Firebase auth errors with generic messages
            let errorMessage = "Invalid email or password. Please try again.";
            
            // Handle rate limiting errors first
            if (error.message?.includes('Too many login attempts') || error.message?.includes('Rate limit exceeded')) {
                errorMessage = error.message; // Use the exact rate limiting message
            }
            // Only show specific messages for non-enumerable errors
            else if (error.code === 'auth/too-many-requests') {
                errorMessage = "Too many failed attempts. Please try again later.";
            } else if (error.code === 'auth/user-disabled') {
                errorMessage = "This account has been disabled. Please contact support.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Please enter a valid email address.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your connection and try again.";
            }
            
            // Show remaining attempts warning only if not rate limited
            if (!error.message?.includes('Too many login attempts') && !error.message?.includes('Rate limit exceeded')) {
                const remainingAttempts = MAX_ATTEMPTS - attempts.length;
                if (remainingAttempts <= 2 && remainingAttempts > 0) {
                    errorMessage += ` ${remainingAttempts} attempt(s) remaining before temporary lockout.`;
                }
            }
            
            setLoginError(errorMessage);
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        setStep(1);
        setPassword("");
        setLoginError("");
        setPasswordError("");
    };

    const handleKeyPress = (e: React.KeyboardEvent, handler: () => void) => {
        if (e.key === 'Enter' && !loading) {
            handler();
        }
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
                            {step === 1 ? "Sign In" : "Enter Password"}
                        </h1>
                    </div>
                </div>

                {/* Error Display */}
                {(error || loginError) && (
                    <div className="w-full py-3 px-1 bg-red-50 border border-red-200 rounded-sm text-center">
                        <p className="text-sm font-body text-center text-red-600">{error || loginError}</p>
                    </div>
                )}

                <div className="flex w-full flex-col gap-4">
                    {step === 1 ? (
                        <>
                            <div className="w-full">
                                <Input
                                    placeholder="Your Email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        const sanitized = sanitizeEmail(e.target.value);
                                        setEmail(sanitized);
                                        validateEmail(sanitized);
                                    }}
                                    onKeyPress={(e) => handleKeyPress(e, handleStep1)}
                                    disabled={loading}
                                    className={`w-full ${
                                        emailError 
                                            ? 'border-red-300 focus:border-red-500' 
                                            : isEmailValid 
                                                ? 'border-green-300 focus:border-green-500' 
                                                : ''
                                    }`}
                                    maxLength={254}
                                />
                                {emailError && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px]">!</span>
                                        {emailError}
                                    </p>
                                )}
                                {isEmailValid && !emailError && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full bg-green-500 text-white flex items-center justify-center text-[8px]">✓</span>
                                        Valid email address
                                    </p>
                                )}
                            </div>
                            <Button3
                                className="w-full"
                                onClick={handleStep1}
                                disabled={loading || !email || !!emailError}
                                loading={loading}
                            >
                                Authenticate
                            </Button3>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    onClick={handleBack}
                                    disabled={loading || isSubmitting}
                                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-gray-600">{email}</span>
                            </div>
                            <div className="w-full">
                                <Input
                                    placeholder="Enter your password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        const sanitized = sanitizePassword(e.target.value);
                                        setPassword(sanitized);
                                        validatePassword(sanitized);
                                    }}
                                    onKeyPress={(e) => handleKeyPress(e, handleStep2)}
                                    disabled={loading || isSubmitting || isBlocked}
                                    className={`w-full ${
                                        passwordError 
                                            ? 'border-red-300 focus:border-red-500' 
                                            : password && !passwordError 
                                                ? 'border-green-300 focus:border-green-500' 
                                                : isBlocked 
                                                    ? 'border-amber-300 bg-amber-50' 
                                                    : ''
                                    }`}
                                    autoFocus
                                    maxLength={128}
                                />
                                {passwordError && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px]">!</span>
                                        {passwordError}
                                    </p>
                                )}
                                {password && !passwordError && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full bg-green-500 text-white flex items-center justify-center text-[8px]">✓</span>
                                        Password meets requirements
                                    </p>
                                )}
                                {isBlocked && (
                                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px]">⏳</span>
                                        Account temporarily locked
                                    </p>
                                )}
                            </div>
                            <Button3
                                className="w-full"
                                size="medium"
                                onClick={handleStep2}
                                disabled={loading || isSubmitting || !password || isBlocked || !!passwordError}
                                loading={loading || isSubmitting}
                            >
                                {isBlocked 
                                    ? `Blocked (${Math.ceil(blockTimeRemaining / 60)}m)` 
                                    : isSubmitting ? "Signing in..." : "Sign In"
                                }
                            </Button3>
                        </>
                    )}
                </div>

                <div className="text-center text-xs text-neutral-400">
                    🔒 Secured Authentication
                </div>
            </div>
        </div>
    );
}

