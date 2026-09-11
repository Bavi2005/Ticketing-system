import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

import { api } from '../api';

const AuthContext = createContext(null);

const API_URL = '/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = localStorage.getItem('token');

      if (!token) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }

        return;
      }

      try {
        const response = await api.get(
          `${API_URL}/auth/me`
        );

        const restoredUser = response.data;

        // Normal user sessions should not restore
        // an administrator account.
        if (restoredUser.role === 'ADMIN') {
          localStorage.removeItem('token');

          if (!cancelled) {
            setUser(null);
          }

          return;
        }

        if (!cancelled) {
          setUser(restoredUser);
        }
      } catch {
        localStorage.removeItem('token');

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (credentials) => {
      const response = await api.post(
        `${API_URL}/auth/login`,
        credentials
      );

      const {
        token,
        user: loggedInUser,
      } = response.data;

      localStorage.setItem(
        'token',
        token
      );

      setUser(loggedInUser);

      return loggedInUser;
    },
    []
  );

  const register = useCallback(
    async (userData) => {
      const response = await api.post(
        `${API_URL}/auth/register`,
        userData
      );

      const {
        token,
        user: createdUser,
      } = response.data;

      localStorage.setItem(
        'token',
        token
      );

      setUser(createdUser);

      return createdUser;
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const updateUser = useCallback(
    (updatedUser) => {
      setUser(updatedUser);
    },
    []
  );

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}