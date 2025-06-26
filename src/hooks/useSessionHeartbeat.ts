import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { forceLogout } from '@/utils/authUtils';

interface SessionHeartbeatConfig {
    heartbeatInterval: number; // milliseconds
    maxInactivity: number; // milliseconds
    enableTabCloseDetection: boolean;
}

const DEFAULT_CONFIG: SessionHeartbeatConfig = {
    heartbeatInterval: 30000, // 30 seconds
    maxInactivity: 900000, // 15 minutes
    enableTabCloseDetection: true
};

/**
 * Simple session heartbeat for auto-logout functionality
 * - Detects tab close/navigation away
 * - Auto-logout after inactivity
 * - Lightweight and non-intrusive
 */
export function useSessionHeartbeat(config: Partial<SessionHeartbeatConfig> = {}) {
    const { user, loading } = useAuth();
    const lastActivityRef = useRef(Date.now());
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // Update last activity on user interaction
    const updateActivity = () => {
        lastActivityRef.current = Date.now();
    };

    useEffect(() => {
        // Only run for authenticated users
        if (!user || loading) return;

        // Add a flag to track if this is a logout cleanup
        let isLogoutCleanup = false;
        let lastLogTime = 0;
        const LOG_INTERVAL = 300000; // 5 minutes between routine logs

        // Only log session start in development
        if (process.env.NODE_ENV === 'development') {
            console.log('[SESSION] Starting session heartbeat for user:', user.email);
        }

        // Track user activity
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // Heartbeat interval to check for inactivity
        heartbeatIntervalRef.current = setInterval(() => {
            const timeSinceLastActivity = Date.now() - lastActivityRef.current;
            
            if (timeSinceLastActivity > finalConfig.maxInactivity) {
                console.warn('[SESSION] Auto-logout due to inactivity');
                forceLogout();
            } else {
                // Only log heartbeat status periodically in development
                const now = Date.now();
                if (process.env.NODE_ENV === 'development' && now - lastLogTime > LOG_INTERVAL) {
                    console.log('[SESSION] Heartbeat active, last activity:', Math.round(timeSinceLastActivity / 1000), 'seconds ago');
                    lastLogTime = now;
                }
            }
        }, finalConfig.heartbeatInterval);

        // Tab close/navigation detection
        const handleBeforeUnload = () => {
            if (finalConfig.enableTabCloseDetection) {
                // Clear session data when tab closes
                localStorage.setItem('session_closed', Date.now().toString());
                // Only log in development
                if (process.env.NODE_ENV === 'development') {
                    console.log('[SESSION] Tab closing - session marked for cleanup');
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab became hidden
                lastActivityRef.current = Date.now();
            } else {
                // Tab became visible - check if session was closed elsewhere
                const sessionClosed = localStorage.getItem('session_closed');
                if (sessionClosed) {
                    const closedTime = parseInt(sessionClosed);
                    const timeSinceClosed = Date.now() - closedTime;
                    
                    // If session was closed recently (within 5 seconds), logout
                    if (timeSinceClosed < 5000) {
                        console.warn('[SESSION] Session was closed in another tab - logging out');
                        forceLogout();
                        return;
                    }
                }
                
                // Update activity when tab becomes visible
                updateActivity();
            }
        };

        // Add event listeners
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup function
        return () => {
            // Check if this cleanup is due to logout
            isLogoutCleanup = !user;
            
            // Only log cleanup in development or if it's a logout
            if (process.env.NODE_ENV === 'development' || isLogoutCleanup) {
                console.log('[SESSION] Cleaning up session heartbeat', isLogoutCleanup ? '(logout)' : '(normal)');
            }
            
            // Remove activity listeners
            activityEvents.forEach(event => {
                document.removeEventListener(event, updateActivity);
            });
            
            // Clear heartbeat interval
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
            
            // Remove other listeners
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            // Clear session data if this is a logout cleanup
            if (isLogoutCleanup) {
                localStorage.removeItem('session_closed');
            }
        };
    }, [user, loading, finalConfig]);

    return {
        lastActivity: lastActivityRef.current,
        updateActivity
    };
} 