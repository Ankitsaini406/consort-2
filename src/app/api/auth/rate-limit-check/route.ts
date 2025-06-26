import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/utils/serverAuth';
import { RateLimiter } from '@/app/admin/forms/utils/rateLimiter';
import { validateFirebaseToken } from '@/utils/serverAuth';
import { isValidEmail } from '@/utils/inputSanitizer';

// Define the type for security headers
type SecurityHeaders = {
    'X-Content-Type-Options': string;
    'X-Frame-Options': string;
    'X-XSS-Protection': string;
    'X-Download-Options': string;
    'X-Permitted-Cross-Domain-Policies': string;
    'Referrer-Policy': string;
    'Content-Security-Policy': string;
    'Cache-Control': string;
    'Pragma': string;
    'Strict-Transport-Security'?: string;
};

// Security headers for all responses
const getSecurityHeaders = (): SecurityHeaders => {
    const headers: SecurityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
    };

    // Add HSTS header in production
    if (process.env.NODE_ENV === 'production') {
        headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
    }

    return headers;
};

// Valid rate limit types
const VALID_RATE_LIMIT_TYPES = [
    'formSubmission',
    'fileUpload',
    'adminAction',
    'strict',
    'authentication',
    'authenticationFailed'
] as const;

type RateLimitType = typeof VALID_RATE_LIMIT_TYPES[number];

interface RateLimitRequest {
    email: string;
    type: RateLimitType;
    failed?: boolean;
}

// Validate rate limit request
function validateRequest(data: any): data is RateLimitRequest {
    if (!data || typeof data !== 'object') return false;
    if (!data.email || !isValidEmail(data.email)) return false;
    if (!data.type || !VALID_RATE_LIMIT_TYPES.includes(data.type)) return false;
    if (data.failed !== undefined && typeof data.failed !== 'boolean') return false;
    return true;
}

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Authentication Rate Limiting Endpoint
 * 
 * This endpoint uses the existing mature rate limiting system to prevent
 * brute force attacks on authentication endpoints.
 * 
 * Supported types:
 * - authentication: 3 attempts per 5 minutes
 * - authenticationFailed: 2 attempts per 15 minutes (after failure)
 * 
 * Security measures:
 * - Requires Firebase authentication
 * - Uses both IP and email for rate limiting
 * - Progressive rate limiting for repeated failures
 * - Strict headers and input validation
 */
export async function POST(request: NextRequest) {
    const ip = getClientIP(request);
    console.log(`[RATE-LIMIT] Check request from IP: ${ip}`);

    try {
        // Skip authentication for rate-limit checks since this is called BEFORE login
        // The endpoint itself is secured by input validation and rate limiting

        // Parse and validate request
        const data = await request.json();
        if (!validateRequest(data)) {
            console.warn(`[RATE-LIMIT] Invalid request format from IP: ${ip}`);
            return NextResponse.json(
                { error: 'Invalid request format' }, 
                { status: 400, headers: getSecurityHeaders() }
            );
        }

        const { email, type, failed } = data;
        
        // Create composite identifier using both IP and email for better security
        const identifier = `${ip}_${email.toLowerCase()}`;
        
        // If this is a failed attempt report
        if (failed) {
            console.log(`[RATE-LIMIT] Recording failed attempt for ${email} from ${ip}`);
            
            // Use progressive rate limiting for failed attempts
            const rateLimitResult = await RateLimiter.checkLimit(identifier, 'authenticationFailed');
            
            if (!rateLimitResult.success) {
                const retryAfter = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
                const headers = {
                    ...getSecurityHeaders(),
                    'Retry-After': retryAfter.toString()
                };

                return NextResponse.json({
                    error: 'Rate limit exceeded',
                    message: 'Too many failed attempts. Account temporarily restricted.',
                    retryAfter,
                    limit: rateLimitResult.limit,
                    remaining: rateLimitResult.remaining,
                    reset: rateLimitResult.reset
                }, { 
                    status: 429,
                    headers
                });
            }
            
            return NextResponse.json({ 
                success: true,
                message: 'Failed attempt recorded',
                remaining: rateLimitResult.remaining,
                limit: rateLimitResult.limit
            }, {
                headers: getSecurityHeaders()
            });
        }

        // For regular rate limit checks
        const rateLimitResult = await RateLimiter.checkLimit(identifier, type);
        
        const response = {
            success: rateLimitResult.success,
            remaining: rateLimitResult.remaining,
            limit: rateLimitResult.limit,
            reset: rateLimitResult.reset
        };

        // Add retry-after information if rate limited
        if (!rateLimitResult.success) {
            const retryAfter = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
            Object.assign(response, { retryAfter });
            
            const headers = {
                ...getSecurityHeaders(),
                'Retry-After': retryAfter.toString()
            };

            return NextResponse.json(response, { 
                status: 429,
                headers
            });
        }

        return NextResponse.json(response, { 
            status: 200,
            headers: getSecurityHeaders()
        });

    } catch (error) {
        console.error('[RATE-LIMIT] Error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            message: 'Failed to check rate limit'
        }, { 
            status: 500,
            headers: getSecurityHeaders()
        });
    }
} 