import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedUser, getClientIP } from '@/utils/serverAuth';
import { FileUploadSecurity } from '@/app/admin/forms/utils/fileUploadSecurity';
import { UPLOAD_CONFIG, getStandardUploadConfig, isPathAllowed, getCorsHeaders } from '@/app/admin/forms/utils/uploadConfig';
import { getAdminStorage, isAdminAvailable } from '@/firebase/firebaseAdmin';

// Standardized CORS headers
const corsHeaders = getCorsHeaders();

// Secure headers for upload endpoints
const getUploadSecurityHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
    return {
        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        // Prevent clickjacking
        'X-Frame-Options': 'DENY',
        // Enable XSS protection
        'X-XSS-Protection': '1; mode=block',
        // Prevent downloads from opening automatically
        'X-Download-Options': 'noopen',
        // Restrict Adobe Flash and PDFs
        'X-Permitted-Cross-Domain-Policies': 'none',
        // Control referrer information
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // Strict CSP for upload endpoints
        'Content-Security-Policy': [
            "default-src 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'none'",
            "connect-src 'self'",
            "img-src 'self' data: https://storage.googleapis.com",
        ].join('; '),
        // Prevent caching of upload responses
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Force HTTPS
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        ...additionalHeaders
    };
};

// Validate file type against whitelist
const isAllowedFileType = (file: File): boolean => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif',
        'image/heic',
        'image/heif',
        'image/svg+xml',
        'application/pdf'
    ];
    return allowedTypes.includes(file.type);
};

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { 
        status: 200, 
        headers: {
            ...corsHeaders,
            ...getUploadSecurityHeaders()
        }
    });
}

async function handleFileUpload(request: NextRequest, user: AuthenticatedUser): Promise<NextResponse> {
    const startTime = Date.now();
    
    try {
        const responseHeaders = new Headers({
            ...corsHeaders,
            ...getUploadSecurityHeaders({ 'Content-Type': 'application/json' })
        });

        console.log(`[ADMIN] File upload request from user: ${user.email}`);

        // Parse form data with error handling
        let formData: FormData;
        try {
            formData = await request.formData();
        } catch (parseError) {
            console.error(`[SECURITY] Form data parsing error:`, parseError);
            return new NextResponse(
                JSON.stringify({ 
                    error: 'Bad Request', 
                    message: 'Invalid form data format'
                }),
                { status: 400, headers: responseHeaders }
            );
        }

        const file = formData.get('file') as File;
        const path = formData.get('path') as string;

        if (!file || !path) {
            console.warn(`[SECURITY] Missing file or path from user: ${user.email}`);
            return new NextResponse(
                JSON.stringify({ error: 'Bad Request', message: 'File and path are required' }),
                { status: 400, headers: responseHeaders }
            );
        }

        // Validate file type
        if (!isAllowedFileType(file)) {
            console.warn(`[SECURITY] Invalid file type attempted: ${file.type} by user: ${user.email}`);
            return new NextResponse(
                JSON.stringify({ 
                    error: 'Invalid File Type', 
                    message: 'File type not allowed'
                }),
                { status: 400, headers: responseHeaders }
            );
        }

        console.log(`[ADMIN] Upload request: ${file.name} (${file.size} bytes) to path: ${path}`);

        // File size validation (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return new NextResponse(
                JSON.stringify({ 
                    error: 'File Too Large', 
                    message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of 10MB`
                }),
                { status: 400, headers: responseHeaders }
            );
        }

        if (file.size === 0) {
            return new NextResponse(
                JSON.stringify({ error: 'Bad Request', message: 'File is empty' }),
                { status: 400, headers: responseHeaders }
            );
        }

        // Enhanced file validation
        let validationResult;
        try {
            validationResult = await FileUploadSecurity.validateFile(file, getStandardUploadConfig());

            if (!validationResult.isValid) {
                console.warn(`[SECURITY] File validation failed for ${file.name} from user: ${user.email}:`, validationResult.errors);
                return new NextResponse(
                    JSON.stringify({ 
                        error: 'File Validation Failed', 
                        message: validationResult.errors.join(', '),
                        warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined
                    }),
                    { status: 400, headers: responseHeaders }
                );
            }

            console.log(`[SECURITY] File validation passed for ${file.name} from user: ${user.email}. Security score: ${validationResult.securityScore}/100`);
            
            // Log any warnings for monitoring
            if (validationResult.warnings.length > 0) {
                console.warn(`[SECURITY] File validation warnings for ${file.name}:`, validationResult.warnings);
            }

        } catch (validationError) {
            console.error(`[SECURITY] File validation error for ${file.name} from user: ${user.email}:`, validationError);
            return new NextResponse(
                JSON.stringify({ 
                    error: 'File Validation Failed', 
                    message: 'Unable to validate file. Please ensure the file is not corrupted and try again.'
                }),
                { status: 400, headers: responseHeaders }
            );
        }

        // Path validation
        if (!isPathAllowed(path)) {
            console.error(`[SECURITY] Invalid upload path: ${path} from user: ${user.email}`);
            return new NextResponse(
                JSON.stringify({ 
                    error: 'Invalid Path', 
                    message: `Path not allowed. Must start with one of: ${UPLOAD_CONFIG.ALLOWED_PATHS.join(', ')}`
                }),
                { status: 400, headers: responseHeaders }
            );
        }
        
        // Sanitize path segments
        const pathSegments = path.split('/').filter(segment => segment.length > 0);
        const sanitizedSegments = pathSegments.map(segment => 
            segment.replace(/[^a-zA-Z0-9\-_\.]/g, '_')
        );
        
        // Construct secure path with user isolation
        const sanitizedPath = sanitizedSegments.join('/');
        const userIdentifier = user.uid.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Create unique filename to prevent conflicts
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const baseFileName = file.name.replace(/\.[^/.]+$/, '');
        const sanitizedFileName = baseFileName.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const uniqueFileName = `${sanitizedFileName}_${timestamp}.${fileExtension}`;
        
        const fullPath = `admin-uploads/${userIdentifier}/${sanitizedPath}/${uniqueFileName}`;

        console.log(`[ADMIN] Uploading to Firebase Storage: ${fullPath}`);

        // Check if Firebase Admin SDK is available
        if (!isAdminAvailable()) {
            throw new Error('Firebase Admin SDK not available. Please check server configuration.');
        }

        // Get Firebase Admin Storage instance
        const adminStorage = getAdminStorage();
        const bucket = adminStorage.bucket();
        
        // Convert file to buffer for Admin SDK upload
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        // Upload to Firebase Storage using Admin SDK
        const fileRef = bucket.file(fullPath);
        await fileRef.save(fileBuffer, {
            metadata: {
                contentType: file.type,
                metadata: {
                    uploadedBy: user.email || '',
                    uploadedAt: new Date().toISOString(),
                    originalName: file.name,
                    fileSize: file.size.toString()
                }
            }
        });

        // Make file publicly accessible (required for website functionality)
        await fileRef.makePublic();
        
        // Generate download URL
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${fullPath}`;

        const uploadTime = Date.now() - startTime;
        console.log(`[ADMIN] File uploaded successfully in ${uploadTime}ms: ${downloadURL}`);

        return new NextResponse(
            JSON.stringify({
                success: true,
                message: 'File uploaded successfully',
                downloadURL,
                data: {
                    url: downloadURL,
                    path: fullPath,
                    filename: uniqueFileName,
                    size: file.size,
                    type: file.type,
                    uploadTime: uploadTime
                }
            }),
            { status: 200, headers: responseHeaders }
        );

    } catch (error) {
        console.error('[ADMIN] Upload error:', error);
        return new NextResponse(
            JSON.stringify({ 
                error: 'Upload Failed', 
                message: 'File upload failed. Please try again or contact support if the problem persists.'
            }),
            { 
                status: 500, 
                headers: {
                    ...corsHeaders,
                    ...getUploadSecurityHeaders({ 'Content-Type': 'application/json' })
                }
            }
        );
    }
}

/**
 * 🔒 ENHANCED UPLOAD SECURITY WRAPPER
 * Implements multiple security layers:
 * - Firebase Admin SDK authentication
 * - Rate limiting (in-memory fallback if Redis unavailable)
 * - IP tracking and abuse prevention
 * - File upload specific protections
 */
async function secureUploadWrapper(
    handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
    request: NextRequest
): Promise<NextResponse> {
    const startTime = Date.now();
    const ip = getClientIP(request);
    
    try {
        // 1. Authentication Check (Required)
        const user = await import('@/utils/serverAuth').then(m => m.validateFirebaseToken(request));
        
        if (!user) {
            console.warn(`[SECURITY] Unauthorized upload attempt from IP: ${ip}`);
            return new NextResponse(
                JSON.stringify({ 
                    error: 'Authentication required',
                    message: 'Please log in to access this resource'
                }),
                { 
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // 2. Rate Limiting (In-memory fallback implementation)
        const rateLimitKey = `upload_${ip}_${user.uid}`;
        const rateLimitResult = await checkUploadRateLimit(rateLimitKey);
        
        if (!rateLimitResult.success) {
            console.warn(`[SECURITY] Rate limit exceeded for upload from ${user.email} (IP: ${ip})`);
            return new NextResponse(
                JSON.stringify({ 
                    error: 'Rate limit exceeded',
                    message: 'Too many upload requests. Please wait before trying again.',
                    retryAfter: Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000)
                }),
                { 
                    status: 429,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Retry-After': Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000).toString()
                    }
                }
            );
        }

        // 3. Additional Upload-specific Security Checks
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
            console.warn(`[SECURITY] Upload size limit exceeded by ${user.email} (IP: ${ip}): ${contentLength} bytes`);
            return new NextResponse(
                JSON.stringify({ 
                    error: 'File too large',
                    message: 'File size exceeds 10MB limit'
                }),
                { 
                    status: 413,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // 4. Execute the protected handler
        console.log(`[SECURITY] Upload request authorized for ${user.email} from IP: ${ip}`);
        const response = await handler(request, user);
        
        const processingTime = Date.now() - startTime;
        console.log(`[SECURITY] Upload request completed in ${processingTime}ms for ${user.email}`);
        
        return response;

    } catch (error) {
        console.error(`[SECURITY] Upload security wrapper error for IP ${ip}:`, error);
        return new NextResponse(
            JSON.stringify({ 
                error: 'Security check failed',
                message: 'Unable to process request due to security validation error'
            }),
            { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * In-memory rate limiting for upload endpoints
 * Fallback when external rate limiting services are unavailable
 */
const uploadRateLimitStore = new Map<string, { count: number; resetTime: number; violations: number }>();

async function checkUploadRateLimit(key: string): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 20; // 20 uploads per minute
    
    let record = uploadRateLimitStore.get(key);
    
    // Clean up expired records
    if (record && now > record.resetTime) {
        uploadRateLimitStore.delete(key);
        record = undefined;
    }
    
    // Initialize new record
    if (!record) {
        record = {
            count: 0,
            resetTime: now + windowMs,
            violations: 0
        };
        uploadRateLimitStore.set(key, record);
    }
    
    // Check if limit exceeded
    if (record.count >= maxRequests) {
        record.violations++;
        
        // Progressive penalties for repeat violators
        if (record.violations >= 3) {
            const penaltyWindow = windowMs * 3; // 3x penalty for repeat offenders
            record.resetTime = Math.max(record.resetTime, now + penaltyWindow);
        }
        
        return {
            success: false,
            limit: maxRequests,
            remaining: 0,
            reset: new Date(record.resetTime)
        };
    }
    
    // Allow request
    record.count++;
    uploadRateLimitStore.set(key, record);
    
    return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - record.count,
        reset: new Date(record.resetTime)
    };
}

// Cleanup expired rate limit records every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of uploadRateLimitStore.entries()) {
        if (now > record.resetTime + 300000) { // 5 minute grace period
            uploadRateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

// Protected GET handler for admin health check
async function handleHealthCheck(request: NextRequest, user: AuthenticatedUser): Promise<NextResponse> {
    console.log(`[ADMIN] Upload endpoint health check by: ${user.email}`);
    
    return new NextResponse(
        JSON.stringify({ 
            status: 'ok', 
            message: 'Upload endpoint is ready and secured',
            timestamp: new Date().toISOString(),
            user: user.email,
            security: {
                authentication: 'Firebase Admin SDK',
                rateLimit: 'In-memory fallback',
                fileValidation: 'Enhanced security checks'
            }
        }),
        { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
        }
    );
}

// Export the SECURED route handlers
export const POST = (request: NextRequest) => secureUploadWrapper(handleFileUpload, request);
export const GET = requireAuth(handleHealthCheck); 