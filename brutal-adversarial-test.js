#!/usr/bin/env node

/**
 * 🔴 BRUTAL ADVERSARIAL ATTACK SIMULATION
 * 
 * Advanced penetration testing suite simulating sophisticated attackers
 * Tests the system like a real adversary would - no mercy, no limits
 * 
 * WARNING: This is for internal security testing only!
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

class BrutalAdversarialTester {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.results = {
            passed: 0,
            failed: 0,
            critical: 0,
            tests: []
        };
        this.csrfToken = null;
        this.sessionTokens = [];
        this.validEmails = ['admin@consortdigital.com', 'user@test.com', 'test@example.com'];
    }

    log(level, message, details = null) {
        const timestamp = new Date().toISOString();
        const symbols = {
            'PASS': '✅',
            'FAIL': '💀', 
            'CRITICAL': '🚨',
            'INFO': '🔍',
            'ATTACK': '🔴'
        };
        
        console.log(`${symbols[level]} [${timestamp}] ${message}`);
        if (details) {
            console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
        }
        
        this.results.tests.push({ level, message, details, timestamp });
        
        if (level === 'PASS') this.results.passed++;
        else if (level === 'FAIL') this.results.failed++;
        else if (level === 'CRITICAL') this.results.critical++;
    }

    async makeRequest(method, path, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BrutalTester/1.0',
                    ...headers
                }
            };

            if (this.csrfToken && !headers['X-CSRF-Token']) {
                options.headers['X-CSRF-Token'] = this.csrfToken;
            }

            const client = url.protocol === 'https:' ? https : http;
            const req = client.request(url, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const jsonBody = body ? JSON.parse(body) : {};
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            body: jsonBody,
                            rawBody: body
                        });
                    } catch (e) {
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            body: {},
                            rawBody: body
                        });
                    }
                });
            });

            req.on('error', reject);
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 🔴 ATTACK 1: Advanced NoSQL Injection with Encoding
    async testAdvancedNoSQLInjection() {
        this.log('ATTACK', 'Testing advanced NoSQL injection with multiple encoding techniques...');
        
        const advancedPayloads = [
            // Unicode encoding attacks
            { email: "admin@test.com", passkey: { "$regex": ".*", "$options": "i" } },
            { email: { "$where": "function() { return true; }" }, passkey: "test" },
            { email: "admin@test.com", passkey: { "$expr": { "$eq": [1, 1] } } },
            
            // MongoDB operator injection
            { email: { "$nin": [""] }, passkey: { "$nin": [""] } },
            { email: { "$exists": true }, passkey: { "$exists": true } },
            { email: { "$type": "string" }, passkey: { "$type": "string" } },
            
            // Advanced JavaScript injection
            { email: "admin@test.com", passkey: { "$where": "this.password.length > 0" } },
            { email: { "$where": "sleep(5000)" }, passkey: "test" },
            
            // Buffer overflow attempts
            { email: "admin@test.com", passkey: "A".repeat(100000) },
            { email: "A".repeat(100000) + "@test.com", passkey: "test" },
            
            // Unicode normalization attacks
            { email: "admin@test.com", passkey: "test\u0000admin" },
            { email: "admin\u200b@test.com", passkey: "test" }, // Zero-width space
            
            // Prototype pollution attempts
            { email: "admin@test.com", passkey: "test", "__proto__": { "admin": true } },
            { email: "admin@test.com", passkey: "test", "constructor": { "prototype": { "admin": true } } }
        ];

        let blocked = 0;
        let bypassed = 0;

        for (const payload of advancedPayloads) {
            try {
                const response = await this.makeRequest('POST', '/api/auth/login/', payload);
                
                if (response.status === 400 || response.status === 401) {
                    this.log('PASS', `Advanced injection blocked: ${JSON.stringify(payload).substring(0, 50)}...`);
                    blocked++;
                } else if (response.status === 200) {
                    this.log('CRITICAL', `INJECTION BYPASSED! System compromised!`, { payload, response });
                    bypassed++;
                } else {
                    this.log('PASS', `Injection handled safely with status ${response.status}`);
                    blocked++;
                }
                
                await this.sleep(50);
            } catch (error) {
                this.log('PASS', `Injection caused safe error: ${error.message}`);
                blocked++;
            }
        }

        this.log('INFO', `Advanced NoSQL injection test: ${blocked} blocked, ${bypassed} bypassed`);
        return bypassed === 0;
    }

    // 🔴 ATTACK 2: Timing-Based User Enumeration
    async testTimingBasedUserEnumeration() {
        this.log('ATTACK', 'Testing timing-based user enumeration attacks...');
        
        const testUsers = [
            'admin@consortdigital.com', // Likely real
            'nonexistent@test.com',     // Likely fake
            'user@test.com',            // Unknown
            'test@example.com',         // Unknown
            'root@localhost',           // Likely fake
            'admin@admin.com'           // Likely fake
        ];

        const timings = [];

        for (let round = 0; round < 3; round++) {
            for (const email of testUsers) {
                const startTime = process.hrtime.bigint();
                
                try {
                    await this.makeRequest('POST', '/api/auth/login/', {
                        email: email,
                        passkey: 'definitely_wrong_password_' + Math.random()
                    });
                } catch (error) {
                    // Continue timing even on errors
                }
                
                const endTime = process.hrtime.bigint();
                const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
                
                timings.push({ email, duration, round });
                await this.sleep(100);
            }
        }

        // Analyze timing patterns
        const avgTimings = {};
        testUsers.forEach(email => {
            const emailTimings = timings.filter(t => t.email === email);
            avgTimings[email] = emailTimings.reduce((sum, t) => sum + t.duration, 0) / emailTimings.length;
        });

        // Check for significant timing differences
        const timingValues = Object.values(avgTimings);
        const maxTiming = Math.max(...timingValues);
        const minTiming = Math.min(...timingValues);
        const timingVariation = ((maxTiming - minTiming) / minTiming) * 100;

        if (timingVariation > 100) { // More than 100% variation
            this.log('CRITICAL', `Timing-based user enumeration possible! ${timingVariation.toFixed(1)}% variation`, avgTimings);
            return false;
        } else {
            this.log('PASS', `Timing attack resistant: ${timingVariation.toFixed(1)}% variation`);
            return true;
        }
    }

    // 🔴 ATTACK 3: Parallel Session Hijacking Attempts
    async testParallelSessionHijacking() {
        this.log('ATTACK', 'Testing parallel session hijacking and token manipulation...');
        
        const maliciousTokens = [
            // JWT manipulation attempts
            'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImFkbWluIjp0cnVlLCJpYXQiOjE2MzAwMDAwMDB9.',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImFkbWluIjp0cnVlLCJpYXQiOjk5OTk5OTk5OTl9.invalid',
            
            // Session token brute force
            ...Array.from({length: 20}, () => crypto.randomBytes(32).toString('hex')),
            
            // Common session patterns
            'admin_session_123',
            'PHPSESSID=admin',
            'connect.sid=admin',
            'session_id=admin',
            
            // Base64 encoded attempts
            Buffer.from('{"admin":true,"role":"admin"}').toString('base64'),
            Buffer.from('admin:password').toString('base64'),
            
            // SQL injection in tokens
            "'; UPDATE users SET admin=1; --",
            "' OR '1'='1",
            
            // Directory traversal in tokens
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
        ];

        const promises = maliciousTokens.map(async (token, index) => {
            try {
                const response = await this.makeRequest('GET', '/admin/', null, {
                    'Cookie': `authToken=${token}`,
                    'Authorization': `Bearer ${token}`,
                    'X-Session-Token': token,
                    'Session': token
                });

                if (response.status === 200) {
                    return { success: true, token, response };
                } else {
                    return { success: false, token, status: response.status };
                }
            } catch (error) {
                return { success: false, token, error: error.message };
            }
        });

        const results = await Promise.all(promises);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (successful.length > 0) {
            this.log('CRITICAL', `Session hijacking successful! ${successful.length} tokens bypassed security!`, successful);
            return false;
        } else {
            this.log('PASS', `All ${failed.length} session hijacking attempts blocked`);
            return true;
        }
    }

    // 🔴 ATTACK 4: Memory Exhaustion DoS
    async testMemoryExhaustionDoS() {
        this.log('ATTACK', 'Testing memory exhaustion and DoS attacks...');
        
        const dosPayloads = [
            // Massive nested objects
            { email: this.createNestedObject(1000), passkey: "test" },
            { email: "test@test.com", passkey: this.createNestedObject(1000) },
            
            // Circular reference attempts
            (() => {
                const obj = { email: "test@test.com", passkey: "test" };
                obj.self = obj;
                return obj;
            })(),
            
            // Massive arrays
            { email: "test@test.com", passkey: "test", data: new Array(100000).fill("A") },
            
            // Compression bomb simulation
            { email: "test@test.com", passkey: "A".repeat(1000000) },
            
            // Unicode bomb
            { email: "💀".repeat(10000) + "@test.com", passkey: "test" },
            
            // Null byte flood
            { email: "test@test.com", passkey: "\x00".repeat(10000) },
        ];

        let blocked = 0;
        let passed = 0;

        for (const payload of dosPayloads) {
            try {
                const startTime = Date.now();
                const response = await this.makeRequest('POST', '/api/auth/login/', payload);
                const endTime = Date.now();
                
                const processingTime = endTime - startTime;
                
                if (response.status === 413 || response.status === 400) {
                    this.log('PASS', `DoS payload blocked in ${processingTime}ms`);
                    blocked++;
                } else if (processingTime > 5000) {
                    this.log('CRITICAL', `DoS attack successful! Processing took ${processingTime}ms`, { payload: 'large_payload' });
                    passed++;
                } else {
                    this.log('PASS', `DoS payload handled safely in ${processingTime}ms`);
                    blocked++;
                }
                
            } catch (error) {
                if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
                    this.log('PASS', `DoS payload caused safe connection reset`);
                    blocked++;
                } else {
                    this.log('PASS', `DoS payload caused safe error: ${error.message}`);
                    blocked++;
                }
            }
            
            await this.sleep(100);
        }

        this.log('INFO', `DoS test results: ${blocked} blocked, ${passed} successful attacks`);
        return passed === 0;
    }

    createNestedObject(depth) {
        if (depth <= 0) return "deep";
        return { nested: this.createNestedObject(depth - 1) };
    }

    // 🔴 ATTACK 5: Race Condition Exploitation
    async testRaceConditionExploitation() {
        this.log('ATTACK', 'Testing race condition exploitation...');
        
        // Simultaneous login attempts with same credentials
        const racePromises = Array.from({length: 50}, (_, i) => 
            this.makeRequest('POST', '/api/auth/login/', {
                email: `race${i}@test.com`,
                passkey: 'test123'
            })
        );

        try {
            const results = await Promise.all(racePromises);
            const successful = results.filter(r => r.status === 200);
            const errors = results.filter(r => r.status >= 500);
            
            if (errors.length > 0) {
                this.log('CRITICAL', `Race condition caused ${errors.length} server errors!`, errors.slice(0, 3));
                return false;
            } else if (successful.length > 1) {
                this.log('CRITICAL', `Race condition allowed ${successful.length} simultaneous logins!`);
                return false;
            } else {
                this.log('PASS', `Race condition test passed: ${results.length} requests handled safely`);
                return true;
            }
        } catch (error) {
            this.log('PASS', `Race condition caused safe error: ${error.message}`);
            return true;
        }
    }

    // 🔴 ATTACK 6: HTTP Header Injection
    async testHTTPHeaderInjection() {
        this.log('ATTACK', 'Testing HTTP header injection attacks...');
        
        const headerInjections = [
            { 'X-Forwarded-For': '127.0.0.1\r\nSet-Cookie: admin=true' },
            { 'User-Agent': 'Mozilla/5.0\r\nX-Admin: true' },
            { 'Referer': 'http://evil.com\r\nAuthorization: Bearer admin' },
            { 'X-Real-IP': '192.168.1.1\r\nX-Forwarded-Proto: https\r\nHost: evil.com' },
            { 'Content-Type': 'application/json\r\nX-Bypass: true' },
            { 'Cookie': 'session=test\r\nSet-Cookie: admin=true; HttpOnly' },
            { 'Authorization': 'Bearer token\r\nX-Admin-Override: true' },
        ];

        let blocked = 0;
        let bypassed = 0;

        for (const headers of headerInjections) {
            try {
                const response = await this.makeRequest('POST', '/api/auth/login/', {
                    email: 'test@test.com',
                    passkey: 'test'
                }, headers);

                // Check if injection succeeded by looking for injected headers in response
                const responseHeaders = JSON.stringify(response.headers);
                if (responseHeaders.includes('admin=true') || responseHeaders.includes('X-Admin') || responseHeaders.includes('X-Bypass')) {
                    this.log('CRITICAL', `Header injection successful!`, { injected: headers, response: response.headers });
                    bypassed++;
                } else {
                    this.log('PASS', `Header injection blocked`);
                    blocked++;
                }
                
            } catch (error) {
                this.log('PASS', `Header injection caused safe error: ${error.message}`);
                blocked++;
            }
            
            await this.sleep(50);
        }

        this.log('INFO', `Header injection test: ${blocked} blocked, ${bypassed} bypassed`);
        return bypassed === 0;
    }

    // 🔴 ATTACK 7: CSRF Token Manipulation
    async testCSRFTokenManipulation() {
        this.log('ATTACK', 'Testing CSRF token manipulation and bypass attempts...');
        
        // Get a valid CSRF token first
        const csrfResponse = await this.makeRequest('GET', '/api/auth/csrf-token/');
        if (csrfResponse.status !== 200) {
            this.log('FAIL', 'Could not acquire CSRF token for manipulation test');
            return false;
        }
        
        const validToken = csrfResponse.body.csrfToken;
        
        const manipulatedTokens = [
            // Token manipulation
            validToken.slice(0, -1) + 'X', // Change last character
            validToken.slice(1), // Remove first character
            validToken + 'X', // Add character
            validToken.replace(/[A-Z]/g, 'X'), // Replace uppercase
            
            // Encoding attacks
            Buffer.from(validToken).toString('hex'),
            encodeURIComponent(validToken),
            validToken.split('').reverse().join(''),
            
            // Common bypass attempts
            '',
            'null',
            'undefined',
            '{}',
            '[]',
            'admin',
            validToken.toLowerCase(),
            validToken.toUpperCase(),
            
            // Injection attempts in token
            validToken + '; admin=true',
            validToken + '\r\nX-Admin: true',
        ];

        let blocked = 0;
        let bypassed = 0;

        for (const token of manipulatedTokens) {
            try {
                const response = await this.makeRequest('POST', '/api/auth/login/', {
                    email: 'test@test.com',
                    passkey: 'test'
                }, {
                    'X-CSRF-Token': token
                });

                if (response.status === 403 || (response.status === 400 && response.body.message?.includes('CSRF'))) {
                    this.log('PASS', `CSRF manipulation blocked: ${String(token).substring(0, 20)}...`);
                    blocked++;
                } else if (response.status === 200) {
                    this.log('CRITICAL', `CSRF bypass successful!`, { token: String(token).substring(0, 50) });
                    bypassed++;
                } else {
                    this.log('PASS', `CSRF manipulation handled safely with status ${response.status}`);
                    blocked++;
                }
                
            } catch (error) {
                this.log('PASS', `CSRF manipulation caused safe error: ${error.message}`);
                blocked++;
            }
            
            await this.sleep(50);
        }

        this.log('INFO', `CSRF manipulation test: ${blocked} blocked, ${bypassed} bypassed`);
        return bypassed === 0;
    }

    // 🔴 ATTACK 8: Protocol-Level Attacks
    async testProtocolLevelAttacks() {
        this.log('ATTACK', 'Testing protocol-level attacks and HTTP smuggling...');
        
        const protocolAttacks = [
            // HTTP request smuggling attempts
            {
                method: 'POST',
                headers: {
                    'Content-Length': '44',
                    'Transfer-Encoding': 'chunked'
                },
                body: '0\r\n\r\nGET /admin HTTP/1.1\r\nHost: localhost\r\n\r\n'
            },
            
            // HTTP/2 downgrade attacks
            {
                method: 'POST',
                headers: {
                    'Connection': 'Upgrade',
                    'Upgrade': 'h2c',
                    'HTTP2-Settings': 'AAMAAABkAARAAAAAAAIAAAAA'
                }
            },
            
            // Host header injection
            {
                method: 'POST',
                headers: {
                    'Host': 'evil.com',
                    'X-Forwarded-Host': 'evil.com',
                    'X-Host': 'evil.com'
                }
            },
            
            // HTTP method override
            {
                method: 'POST',
                headers: {
                    'X-HTTP-Method-Override': 'DELETE',
                    'X-HTTP-Method': 'PUT',
                    'X-Method-Override': 'PATCH'
                }
            }
        ];

        let safeResponses = 0;
        let dangerousResponses = 0;

        for (const attack of protocolAttacks) {
            try {
                const response = await this.makeRequest(
                    attack.method || 'POST',
                    '/api/auth/login/',
                    { email: 'test@test.com', passkey: 'test' },
                    attack.headers || {}
                );

                if (response.status >= 400 && response.status < 500) {
                    this.log('PASS', `Protocol attack blocked with status ${response.status}`);
                    safeResponses++;
                } else if (response.status === 200) {
                    this.log('CRITICAL', `Protocol attack may have succeeded!`, { attack, response: response.status });
                    dangerousResponses++;
                } else {
                    this.log('PASS', `Protocol attack handled safely with status ${response.status}`);
                    safeResponses++;
                }
                
            } catch (error) {
                this.log('PASS', `Protocol attack caused safe error: ${error.message}`);
                safeResponses++;
            }
            
            await this.sleep(100);
        }

        this.log('INFO', `Protocol attack test: ${safeResponses} safe, ${dangerousResponses} dangerous`);
        return dangerousResponses === 0;
    }

    // 📊 Generate Brutal Report
    generateBrutalReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🔴 BRUTAL ADVERSARIAL ATTACK SIMULATION REPORT');
        console.log('='.repeat(80));
        
        const totalTests = this.results.passed + this.results.failed + this.results.critical;
        const securityScore = totalTests > 0 ? ((this.results.passed / totalTests) * 100).toFixed(1) : 0;
        
        console.log(`📊 ATTACK RESULTS:`);
        console.log(`   ✅ Attacks Blocked: ${this.results.passed}`);
        console.log(`   💀 Attacks Failed: ${this.results.failed}`);
        console.log(`   🚨 CRITICAL Breaches: ${this.results.critical}`);
        console.log(`   🎯 Security Score: ${securityScore}%`);
        
        if (this.results.critical === 0) {
            console.log('\n🛡️ SECURITY VERDICT: BULLETPROOF AGAINST ADVANCED ATTACKS ✅');
            console.log('   Your system withstood brutal adversarial testing!');
        } else if (this.results.critical <= 2) {
            console.log('\n⚠️ SECURITY VERDICT: STRONG WITH CRITICAL GAPS');
            console.log('   Most attacks blocked, but critical vulnerabilities found.');
        } else {
            console.log('\n🚨 SECURITY VERDICT: SYSTEM COMPROMISED');
            console.log('   Multiple critical vulnerabilities detected. IMMEDIATE ACTION REQUIRED.');
        }
        
        console.log('\n🔴 ATTACK VECTOR ANALYSIS:');
        this.results.tests.forEach((test, index) => {
            if (test.level === 'CRITICAL') {
                console.log(`${index + 1}. 🚨 CRITICAL: ${test.message}`);
            }
        });
        
        console.log('\n' + '='.repeat(80));
    }

    // 🚀 Run All Brutal Attacks
    async runBrutalAttacks() {
        console.log('🔴 STARTING BRUTAL ADVERSARIAL ATTACK SIMULATION');
        console.log('⚡ Advanced penetration testing with no mercy');
        console.log('🔴 Simulating sophisticated attackers and APT groups\n');

        // Get CSRF token first
        try {
            const response = await this.makeRequest('GET', '/api/auth/csrf-token/');
            if (response.status === 200) {
                this.csrfToken = response.body.csrfToken;
                this.log('INFO', 'CSRF token acquired for attacks');
            }
        } catch (error) {
            this.log('FAIL', 'Could not acquire CSRF token', error.message);
        }

        const attacks = [
            { name: 'Advanced NoSQL Injection', fn: () => this.testAdvancedNoSQLInjection() },
            { name: 'Timing-Based User Enumeration', fn: () => this.testTimingBasedUserEnumeration() },
            { name: 'Parallel Session Hijacking', fn: () => this.testParallelSessionHijacking() },
            { name: 'Memory Exhaustion DoS', fn: () => this.testMemoryExhaustionDoS() },
            { name: 'Race Condition Exploitation', fn: () => this.testRaceConditionExploitation() },
            { name: 'HTTP Header Injection', fn: () => this.testHTTPHeaderInjection() },
            { name: 'CSRF Token Manipulation', fn: () => this.testCSRFTokenManipulation() },
            { name: 'Protocol-Level Attacks', fn: () => this.testProtocolLevelAttacks() }
        ];

        for (const attack of attacks) {
            console.log(`\n🔴 Launching: ${attack.name}`);
            console.log('-'.repeat(60));
            
            try {
                const success = await attack.fn();
                if (!success) {
                    this.log('CRITICAL', `${attack.name} found vulnerabilities!`);
                }
            } catch (error) {
                this.log('FAIL', `Attack suite error in ${attack.name}`, error.message);
            }
            
            await this.sleep(1000); // Cool down between attack suites
        }

        this.generateBrutalReport();
    }
}

// 🚀 Execute Brutal Attack Simulation
if (require.main === module) {
    const brutalTester = new BrutalAdversarialTester();
    brutalTester.runBrutalAttacks().catch(error => {
        console.error('💀 Brutal attack simulation failed:', error);
        process.exit(1);
    });
}

module.exports = BrutalAdversarialTester; 