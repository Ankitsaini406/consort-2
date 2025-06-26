import { NextRequest, NextResponse } from "next/server";
import { getClientIP } from '@/utils/serverAuth';
import { AUTH_COOKIE_CONFIG } from '@/utils/authUtils';
import { RateLimiter } from '@/app/admin/forms/utils/rateLimiter';
import { TokenRevocation, SessionStore } from '@/utils/serverAuth';
import { validateFirebaseToken } from '@/utils/serverAuth';

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
        // Add Clear-Site-Data header in production for complete cleanup
        headers['Clear-Site-Data'] = '"cache","cookies","storage"';
    }

    return headers;
};

export async function POST(request: NextRequest) {
    const ip = getClientIP(request);
    console.log(`[AUTH] Logout request from IP: ${ip}`);

    try {
        // Apply rate limiting to logout requests to prevent abuse
        const rateLimitResult = await RateLimiter.checkLimit(ip, 'authentication');
        
        if (!rateLimitResult.success) {
            const retryAfter = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
            return NextResponse.json({ 
                success: false,
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please try again later.',
                retryAfter
            }, { 
                status: 429,
                headers: {
                    ...getAuthSecurityHeaders(),
                    'Retry-After': retryAfter.toString()
                }
            });
        }

        // Validate the current user's token
        const user = await validateFirebaseToken(request);
        
        if (user) {
            // Revoke the user's current token
            await TokenRevocation.revokeToken(user.uid);
            
            // Clear all sessions for this user
            await SessionStore.revokeUserSessions(user.uid);
            
            console.log(`[AUTH] User ${user.email} logged out and sessions cleared from IP: ${ip}`);
        }
        
        const response = NextResponse.json({ 
            success: true, 
            message: "Logged out successfully",
            timestamp: new Date().toISOString()
        }, {
            headers: getAuthSecurityHeaders()
        });
        
        // Clear all auth-related cookies
        const cookiesToClear = [
            AUTH_COOKIE_CONFIG.FIREBASE_TOKEN,
            'authToken',
            'sessionId'
        ];

        for (const cookieName of cookiesToClear) {
            response.cookies.set(cookieName, "", {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                expires: new Date(0),
                path: '/',
            });
        }

        return response;

    } catch (error) {
        console.error("[AUTH] Logout error:", error);
        return NextResponse.json({ 
            success: false, 
            message: "Logout failed",
            error: "An error occurred during logout"  // Don't expose internal error details
        }, { 
            status: 500,
            headers: getAuthSecurityHeaders()
        });
    }
}
