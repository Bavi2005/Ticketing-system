import {
  useState,
} from 'react';

import {
  useNavigate,
  Link,
} from 'react-router-dom';

import {
  useForm,
} from 'react-hook-form';

import { z } from 'zod';

import {
  zodResolver,
} from '@hookform/resolvers/zod';

import {
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

import {
  useAuth,
} from '../contexts/AuthContext';

import AuthLayout from '../components/AuthLayout';

import {
  Field,
  btnSmPrimary,
  Alert,
  inputCls,
  labelCls,
} from '../components/ui';

const LoginSchema =
  z.object({
    email: z
      .string()
      .trim()
      .min(
        1,
        'Enter your email address or phone number'
      ),

    password: z
      .string()
      .min(
        1,
        'Password is required'
      ),
  });

export default function Login() {
  const {
    login,
  } = useAuth();

  const navigate =
    useNavigate();

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    authError,
    setAuthError,
  ] = useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
    },
  } = useForm({
    resolver:
      zodResolver(
        LoginSchema
      ),

    mode: 'onChange',
  });

  const onSubmit =
    async (data) => {
      setLoading(true);
      setAuthError('');

      try {
        await login({
          email:
            data.email.trim(),

          password:
            data.password,
        });

        navigate(
          '/dashboard'
        );
      } catch (error) {
        setAuthError(
          error.response
            ?.data?.message ||
            'Login failed. Check your details and password.'
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your email address or phone number."
      headline="Your receipt rewards in one place."
      brandPoints={[
        'Submit purchase receipts',
        'Track pending and approved receipts',
        'View and redeem issued vouchers',
      ]}
      footer={
        <div className="mt-10 space-y-3 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Don't have an
            account?{' '}
            <Link
              to="/register"
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Create one
            </Link>
          </p>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Are you staff?{' '}
            <Link
              to="/admin/login"
              className="font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
            >
              Admin portal
            </Link>
          </p>
        </div>
      }
    >
      {authError && (
        <Alert>
          {authError}
        </Alert>
      )}

      <form
        onSubmit={
          handleSubmit(
            onSubmit
          )
        }
        className="space-y-5"
      >
        <Field
          id="email"
          label="Email or phone"
          type="text"
          placeholder="you@example.com or +60 12 345 6789"
          error={
            errors.email
              ?.message
          }
          autoComplete="username"
          {...register(
            'email'
          )}
        />

        <div>
          <label
            htmlFor="password"
            className={
              labelCls
            }
          >
            Password
          </label>

          <div className="relative">
            <input
              id="password"
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              placeholder="••••••••"
              autoComplete="current-password"
              className={`${inputCls} pr-11`}
              {...register(
                'password'
              )}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (value) =>
                    !value
                )
              }
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              {showPassword ? (
                <EyeOff className="h-4.5 w-4.5" />
              ) : (
                <Eye className="h-4.5 w-4.5" />
              )}
            </button>
          </div>

          {errors.password && (
            <p className="mt-1.5 text-[13px] font-medium text-rose-600">
              {
                errors.password
                  .message
              }
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`${btnSmPrimary} w-full py-3.5`}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}