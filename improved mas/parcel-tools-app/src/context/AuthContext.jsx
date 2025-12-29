import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing session on mount
        const checkSession = async () => {
            const userId = localStorage.getItem('userId');
            const userEmail = localStorage.getItem('userEmail');
            const licenseKey = localStorage.getItem('licenseKey');

            if (userId) {
                try {
                    // Verify session with backend
                    const response = await fetch('http://localhost:5000/api/auth/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId })
                    });

                    const data = await response.json();

                    if (response.ok && data.valid) {
                        setUser({
                            userId,
                            email: data.email || userEmail,
                            licenseKey: data.licenseKey || licenseKey
                        });
                    } else {
                        // Session invalid, clear storage
                        logout();
                    }
                } catch (error) {
                    console.error('[Auth] Session verification failed:', error);
                    // Keep user logged in offline
                    if (userEmail && licenseKey) {
                        setUser({ userId, email: userEmail, licenseKey });
                    }
                }
            }

            setLoading(false);
        };

        checkSession();
    }, []);

    const login = (userId, email, licenseKey) => {
        localStorage.setItem('userId', userId);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('licenseKey', licenseKey);
        setUser({ userId, email, licenseKey });
    };

    const logout = async () => {
        try {
            // Call backend to deactivate device
            const userId = localStorage.getItem('userId');
            if (userId) {
                await fetch('http://localhost:5000/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
            }
        } catch (error) {
            console.error('[Auth] Logout error:', error);
            // Continue with logout even if backend call fails
        } finally {
            // Clear local storage
            localStorage.removeItem('userId');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('licenseKey');
            setUser(null);
        }
    };

    const value = {
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
