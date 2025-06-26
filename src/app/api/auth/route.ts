import { NextRequest, NextResponse } from "next/server";
import { getClientIP } from '@/utils/serverAuth';
import { RateLimiter } from '@/app/admin/forms/utils/rateLimiter';
import { extractUserFromToken } from '@/utils/firebaseAuthServer';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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
    'Clear-Site-Data'?: string;
    'Strict-Transport-Security'?: string;
};

// Security headers for authentication endpoints
const getAuthSecurityHeaders = (): SecurityHeaders => {
    const headers: SecurityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache'
    };

    // Add HSTS header in production
    if (process.env.NODE_ENV === 'production') {
        headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
    }

    return headers;
};

export async function GET(req: NextRequest) {
    try {
        // Apply rate limiting for authentication requests
        const ip = getClientIP(req);
        const rateLimitResult = await RateLimiter.checkLimit(ip, 'authentication');
        
        if (!rateLimitResult.success) {
            const retryAfter = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
            return NextResponse.json({ 
                user: null,
                error: 'Rate limit exceeded',
                message: 'Too many authentication requests. Please try again later.',
                retryAfter
            }, { 
                status: 429,
                headers: {
                    ...getAuthSecurityHeaders(),
                    'Retry-After': retryAfter.toString()
                }
            });
        }

        // Use Firebase authentication
        const userInfo = await extractUserFromToken(req);
        if (!userInfo) {
            return NextResponse.json(
                { user: null }, 
                { 
                    status: 401,
                    headers: getAuthSecurityHeaders()
                }
            );
        }

        // Return user in expected format
        const user = {
            id: userInfo.userId,
            role: userInfo.role,
            email: userInfo.email,
            name: userInfo.email?.split('@')[0] || 'User'
        };

        return NextResponse.json(
            { user }, 
            { headers: getAuthSecurityHeaders() }
        );
    } catch (error) {
        console.error("Error in auth API:", error);
        return NextResponse.json(
            { 
                user: null,
                error: 'Authentication failed',
                message: 'An error occurred during authentication'
            }, 
            { 
                status: 401,
                headers: getAuthSecurityHeaders()
            }
        );
    }
}
