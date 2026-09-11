import { useState } from 'react';
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
  useAuth,
} from '../contexts/AuthContext';

import AuthLayout from '../components/AuthLayout';

import {
  Field,
  Button,
  Alert,
} from '../components/ui';

const RegisterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        2,
        'Name must be at least 2 characters'
      ),

    email: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .email(
          'Invalid email address'
        ),
    ]),

    phone: z
      .string()
      .refine(
        (value) =>
          !value.trim() ||
          value.trim().length >= 6,
        'Enter a valid phone number'
      ),

    password: z
      .string()
      .min(
        6,
        'Password must be at least 6 characters'
      ),

    confirmPassword: z
      .string()
      .min(
        6,
        'Password must be at least 6 characters'
      ),
  })
  .refine(
    (data) =>
      Boolean(
        data.email.trim() ||
        data.phone.trim()
      ),
    {
      message:
        'Enter an email address or phone number',
      path: ['email'],
    }
  )
  .refine(
    (data) =>
      data.password ===
      data.confirmPassword,
    {
      message:
        "Passwords don't match",
      path: [
        'confirmPassword',
      ],
    }
  );

export default function Register() {
  const {
    register:
      authRegister,
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

  const {
    register,
    handleSubmit,
    formState: {
      errors,
    },
  } = useForm({
    resolver:
      zodResolver(
        RegisterSchema
      ),

    mode: 'onChange',

    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit =
    async (data) => {
      setLoading(true);
      setAuthError('');

      try {
        const userData = {
          name:
            data.name.trim(),

          password:
            data.password,
        };

        if (
          data.email.trim()
        ) {
          userData.email =
            data.email.trim();
        }

        if (
          data.phone.trim()
        ) {
          userData.phone =
            data.phone.trim();
        }

        await authRegister(
          userData
        );

        navigate(
          '/dashboard'
        );
      } catch (error) {
        setAuthError(
          error.response
            ?.data?.message ||
            'Registration failed. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register with an email address or phone number."
      headline="Submit receipts. Get rewarded."
      brandPoints={[
        'Upload purchase receipts securely',
        'Track receipt review status',
        'Receive a voucher after approval',
      ]}
      footer={
        <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an
          account?{' '}
          <Link
            to="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Sign in
          </Link>
        </p>
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
          id="name"
          label="Full name"
          type="text"
          placeholder="Jane Doe"
          error={
            errors.name
              ?.message
          }
          {...register(
            'name'
          )}
        />

        <Field
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={
            errors.email
              ?.message
          }
          {...register(
            'email'
          )}
        />

        <div className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
          or
        </div>

        <Field
          id="phone"
          label="Phone number"
          type="tel"
          placeholder="+60 12 345 6789"
          error={
            errors.phone
              ?.message
          }
          {...register(
            'phone'
          )}
        />

        <p className="text-xs text-gray-400 dark:text-slate-500">
          At least one of email
          or phone number is
          required.
        </p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            error={
              errors.password
                ?.message
            }
            {...register(
              'password'
            )}
          />

          <Field
            id="confirmPassword"
            label="Confirm"
            type="password"
            placeholder="••••••••"
            error={
              errors
                .confirmPassword
                ?.message
            }
            {...register(
              'confirmPassword'
            )}
          />
        </div>

        <Button
          type="submit"
          loading={loading}
          loadingText="Creating account…"
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}