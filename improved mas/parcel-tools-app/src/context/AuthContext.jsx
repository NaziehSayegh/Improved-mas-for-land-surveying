import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            const userId      = localStorage.getItem('userId');
            const userEmail   = localStorage.getItem('userEmail');
            const accountType = localStorage.getItem('accountType') || 'premium';
            const sessionToken = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
            const loginTimestamp = localStorage.getItem('loginTimestamp') || Date.now().toString();

            if (userId) {
                let verified = false;
                // Retry up to 8 times (4 seconds total) while Python engine initializes on app startup
                for (let attempt = 0; attempt < 8; attempt++) {
                    try {
                        const res = await fetch('http://127.0.0.1:5000/api/auth/verify', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
                            },
                            body: JSON.stringify({ userId, sessionToken }),
                        });

                        const data = await res.json();

                        if (res.ok && data.valid) {
                            const tokenToUse = data.sessionToken || sessionToken;
                            if (tokenToUse) {
                                sessionStorage.setItem('sessionToken', tokenToUse);
                                localStorage.setItem('sessionToken', tokenToUse);
                            }
                            if (data.accountType) {
                                localStorage.setItem('accountType', data.accountType);
                            }
                            localStorage.setItem('loginTimestamp', (data.loginTimestamp ? data.loginTimestamp * 1000 : Date.now()).toString());
                            setUser({
                                userId,
                                email:        data.email || userEmail,
                                accountType:  data.accountType || accountType,
                                isAdmin:      data.isAdmin || false,
                                licenseKey:   data.licenseKey || null,
                                sessionToken: tokenToUse || null,
                                loginTimestamp: data.loginTimestamp || Date.now(),
                            });
                            verified = true;
                            break;
                        } else {
                            // Explicit invalid session response
                            logout();
                            verified = true;
                            break;
                        }
                    } catch {
                        // Network error (backend still booting up), wait 500ms and retry
                        await new Promise((resolve) => setTimeout(resolve, 500));
                    }
                }

                if (!verified) {
                    // Backend unreachable after retries — keep user logged in persistently based on timestamp (valid up to 365 days)
                    const maxAgeMs = 365 * 24 * 60 * 60 * 1000;
                    const sessionAge = Date.now() - parseInt(loginTimestamp || '0', 10);
                    if (userEmail && sessionToken && sessionAge < maxAgeMs) {
                        setUser({ userId, email: userEmail, accountType, isAdmin: false, sessionToken, loginTimestamp });
                    } else {
                        logout();
                    }
                }
            }

            setLoading(false);
        };

        checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * login — called after successful /api/auth/login or /api/auth/signup.
     * Stores persistent info in localStorage, token in sessionStorage.
     */
    const login = (userId, email, licenseKey, sessionToken, accountType = 'premium', isAdmin = false, loginTimestamp = null) => {
        const nowTs = loginTimestamp ? loginTimestamp * 1000 : Date.now();
        localStorage.setItem('userId',      userId);
        localStorage.setItem('userEmail',   email);
        localStorage.setItem('accountType', accountType);
        localStorage.setItem('loginTimestamp', nowTs.toString());
        sessionStorage.setItem('sessionToken', sessionToken || '');
        localStorage.setItem('sessionToken', sessionToken || '');
        setUser({ userId, email, licenseKey, sessionToken, accountType, isAdmin, loginTimestamp: nowTs });
    };

    const logout = async () => {
        try {
            const userId = localStorage.getItem('userId');
            if (userId) {
                await fetch('http://127.0.0.1:5000/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId }),
                });
            }
        } catch {
            // Continue with logout even if backend call fails
        } finally {
            localStorage.removeItem('userId');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('accountType');
            localStorage.removeItem('loginTimestamp');
            sessionStorage.removeItem('sessionToken');
            localStorage.removeItem('sessionToken');
            setUser(null);
        }
    };

    const value = {
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin:         !!user?.isAdmin,
        isDemo:          user?.accountType === 'demo',
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
