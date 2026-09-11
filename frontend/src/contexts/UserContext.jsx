import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

import { api } from '../api';
import { useAuth } from './AuthContext';

const UserContext = createContext(null);

const API_URL = '/api';

export const UserProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();

  const [stats, setStats] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [vouchers, setVouchers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Remove old account data immediately after logout.
  useEffect(() => {
    if (!authLoading && !user) {
      setStats(null);
      setReceipts([]);
      setVouchers([]);
      setError(null);
    }
  }, [user, authLoading]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get(
        `${API_URL}/user/dashboard`
      );

      setStats(response.data);
      setError(null);

      return response.data;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Failed to fetch dashboard stats';

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get(
        `${API_URL}/user/receipts`
      );

      setReceipts(response.data);
      setError(null);

      return response.data;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Failed to fetch receipts';

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get(
        `${API_URL}/user/vouchers`
      );

      setVouchers(response.data);
      setError(null);

      return response.data;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Failed to fetch vouchers';

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      await Promise.all([
        fetchStats(),
        fetchReceipts(),
        fetchVouchers(),
      ]);
    } catch {
      // Individual fetch functions already store the useful error message.
    }
  }, [
    fetchStats,
    fetchReceipts,
    fetchVouchers,
  ]);

  const value = {
    stats,
    receipts,
    vouchers,

    loading,
    error,

    refreshStats,
    fetchStats,
    fetchReceipts,
    fetchVouchers,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error(
      'useUser must be used within a UserProvider'
    );
  }

  return context;
};