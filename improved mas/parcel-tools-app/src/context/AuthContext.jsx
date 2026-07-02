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
            // Session token stored in sessionStorage and localStorage for persistence
            const sessionToken = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');

            if (userId) {
                try {
                    const res = await fetch('http://localhost:5000/api/auth/verify', {
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
                        setUser({
                            userId,
                            email:        data.email || userEmail,
                            accountType:  data.accountType || accountType,
                            isAdmin:      data.isAdmin || false,
                            licenseKey:   data.licenseKey || null,
                            sessionToken: tokenToUse || null,
                        });
                    } else {
                        logout();
                    }
                } catch {
                    // Keep user logged in offline if we have a stored session
                    if (userEmail && sessionToken) {
                        setUser({ userId, email: userEmail, accountType, isAdmin: false, sessionToken });
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
    const login = (userId, email, licenseKey, sessionToken, accountType = 'premium', isAdmin = false) => {
        localStorage.setItem('userId',      userId);
        localStorage.setItem('userEmail',   email);
        localStorage.setItem('accountType', accountType);
        sessionStorage.setItem('sessionToken', sessionToken || '');
        localStorage.setItem('sessionToken', sessionToken || '');
        setUser({ userId, email, licenseKey, sessionToken, accountType, isAdmin });
    };

    const logout = async () => {
        try {
            const userId = localStorage.getItem('userId');
            if (userId) {
                await fetch('http://localhost:5000/api/auth/logout', {
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
