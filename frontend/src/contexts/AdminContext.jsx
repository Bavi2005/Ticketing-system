import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

import { api } from '../api';

const AdminContext = createContext(null);

const API_URL = '/api';

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState(null);
  const [receipts, setReceipts] = useState([]);

  const [adminLoading, setAdminLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const checkAdminAuth = async () => {
      const token = localStorage.getItem('adminToken');

      if (!token) {
        if (!cancelled) {
          setAdmin(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await api.get(
          `${API_URL}/admin/me`
        );

        if (!cancelled) {
          setAdmin(response.data);
        }
      } catch {
        localStorage.removeItem('adminToken');

        if (!cancelled) {
          setAdmin(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    checkAdminAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await api.post(
      `${API_URL}/admin/login`,
      credentials
    );

    const {
      token,
      admin: loggedInAdmin,
    } = response.data;

    localStorage.setItem('adminToken', token);
    setAdmin(loggedInAdmin);

    return loggedInAdmin;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('adminToken');

    setAdmin(null);
    setStats(null);
    setReceipts([]);
    setError(null);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setAdminLoading(true);

      const response = await api.get(
        `${API_URL}/admin/dashboard`
      );

      setStats(response.data);
      setError(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to fetch stats'
      );
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const fetchReceipts = useCallback(async () => {
    try {
      setAdminLoading(true);

      const response = await api.get(
        `${API_URL}/admin/receipts`
      );

      setReceipts(response.data);
      setError(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to fetch receipts'
      );
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const approveReceipt = useCallback(
    async (receiptId) => {
      await api.post(
        `${API_URL}/admin/receipts/${receiptId}/approve`
      );

      await Promise.all([
        fetchReceipts(),
        fetchStats(),
      ]);
    },
    [fetchReceipts, fetchStats]
  );

  const rejectReceipt = useCallback(
    async (receiptId) => {
      await api.post(
        `${API_URL}/admin/receipts/${receiptId}/reject`
      );

      await Promise.all([
        fetchReceipts(),
        fetchStats(),
      ]);
    },
    [fetchReceipts, fetchStats]
  );

  const value = {
    admin,
    login,
    logout,
    loading,

    stats,
    receipts,
    adminLoading,
    error,

    fetchStats,
    fetchReceipts,
    approveReceipt,
    rejectReceipt,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);

  if (!context) {
    throw new Error(
      'useAdmin must be used within an AdminProvider'
    );
  }

  return context;
};