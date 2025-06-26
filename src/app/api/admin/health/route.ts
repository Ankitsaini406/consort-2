import { NextRequest, NextResponse } from 'next/server';
import { isAdminAvailable, testFirebaseConnection } from '@/firebase/firebaseAdmin';
import { validateFirebaseToken } from '@/utils/serverAuth';
import { SessionStore, TokenRevocation } from '@/utils/serverAuth';
import { getCSRFHealthStatus } from '@/utils/csrfProtection';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication Check
    const user = await validateFirebaseToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Firebase Health Check
    let firebaseHealth = {
      status: 'unknown',
      error: null as string | null,
      connectionTest: null as any
    };

    try {
      const isAvailable = isAdminAvailable();
      if (isAvailable) {
        const connectionTestResult = await testFirebaseConnection();
        firebaseHealth = {
          status: connectionTestResult.success ? 'healthy' : 'unhealthy',
          error: connectionTestResult.success ? null : connectionTestResult.error,
          connectionTest: connectionTestResult
        };
      } else {
        firebaseHealth = {
          status: 'unhealthy',
          error: 'Firebase Admin SDK not available',
          connectionTest: null
        };
      }
    } catch (error) {
      firebaseHealth = {
        status: 'error',
        error: (error as Error).message,
        connectionTest: null
      };
    }

    // 3. Session Health Check
    const sessionHealth = {
      activeSessions: await SessionStore.getActiveSessionCount(),
      revokedTokens: await TokenRevocation.getRevokedTokenCount(),
      cleanedSessions: await SessionStore.cleanupExpiredSessions()
    };

    // 4. CSRF Health Check
    const csrfHealth = getCSRFHealthStatus();

    // 5. Environment Check
    const requiredEnvVars = [
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'JWT_SECRET'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    const environmentHealth = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
      missingVariables: missingEnvVars.length > 0 ? missingEnvVars : undefined
    };

    // 6. System Information
    const systemHealth = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };

    // Determine overall health status
    const isHealthy = 
      firebaseHealth.status === 'healthy' &&
      environmentHealth.status === 'healthy' &&
      csrfHealth.healthy;

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      components: {
        firebase: firebaseHealth,
        sessions: sessionHealth,
        csrf: csrfHealth,
        environment: environmentHealth,
        system: systemHealth
      }
    }, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

  } catch (error) {
    console.error('[HEALTH] System health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
} 