import { NextRequest } from 'next/server';
import { requireAuthWithRateLimit, AuthenticatedUser, SessionStore, TokenRevocation } from '@/utils/serverAuth';
import { AUTH_COOKIE_CONFIG } from '@/utils/authUtils';

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

/**
 * Enhanced server-side session invalidation with token revocation
 * Forces logout by clearing server-side session markers and revoking tokens
 */
async function handleSessionInvalidation(request: NextRequest, user: AuthenticatedUser): Promise<Response> {
    try {
        console.log(`[SESSION-INVALIDATE] Session invalidation requested by: ${user.email}`);

        // NEW: Revoke the user's token to prevent reuse
        await TokenRevocation.revokeToken(user.uid);

        // NEW: Revoke all sessions for this user
        const revokedSessionCount = await SessionStore.revokeUserSessions(user.uid);

        const response = new Response(
            JSON.stringify({
                success: true,
                message: 'Session invalidated successfully',
                timestamp: new Date().toISOString(),
                revokedSessions: revokedSessionCount
            }),
            {
                status: 200,
                headers: {
                    ...getAuthSecurityHeaders(),
                    'Content-Type': 'application/json'
                }
            }
        );

        // Clear the authentication cookie with HttpOnly flag
        response.headers.set(
            'Set-Cookie', 
            AUTH_COOKIE_CONFIG.getExpiredHttpOnlyCookieString(AUTH_COOKIE_CONFIG.FIREBASE_TOKEN)
        );

        console.log(`[SESSION-INVALIDATE] Session invalidated for user: ${user.email}, revoked ${revokedSessionCount} sessions`);
        return response;

    } catch (error) {
        console.error('[SESSION-INVALIDATE] Error:', error);
        return new Response(
            JSON.stringify({
                error: 'Session invalidation failed',
                message: 'Unable to invalidate session. Please try logging out and back in.'
            }),
            { 
                status: 500,
                headers: {
                    ...getAuthSecurityHeaders(),
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}

// Export the protected route handler with rate limiting (admin action type)
export const POST = requireAuthWithRateLimit(handleSessionInvalidation, 'adminAction'); 