import {
  useState,
} from 'react';

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

import { api } from '../api';

import {
  useToast,
  PageHeader,
  Field,
  btnSmPrimary,
} from '../components/ui';

const SettingsSchema = z
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

    currentPassword:
      z.string().optional(),

    newPassword: z
      .string()
      .min(
        6,
        'Password must be at least 6 characters'
      )
      .optional()
      .or(
        z.literal('')
      ),

    confirmNewPassword:
      z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.email.trim() ||
        data.phone.trim()
      ),
    {
      message:
        'Keep at least one login method: email or phone',
      path: ['email'],
    }
  )
  .refine(
    (data) =>
      !data.newPassword ||
      Boolean(
        data.currentPassword
      ),
    {
      message:
        'Current password is required',
      path: [
        'currentPassword',
      ],
    }
  )
  .refine(
    (data) =>
      !data.newPassword ||
      data.newPassword ===
        data.confirmNewPassword,
    {
      message:
        "Passwords don't match",
      path: [
        'confirmNewPassword',
      ],
    }
  );

export default function Settings() {
  const {
    user,
    updateUser,
  } = useAuth();

  const {
    success,
    error: toastError,
  } = useToast();

  const [
    loading,
    setLoading,
  ] = useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
    },
    setValue,
  } = useForm({
    resolver:
      zodResolver(
        SettingsSchema
      ),

    mode: 'onChange',

    defaultValues: {
      name:
        user?.name || '',

      email:
        user?.email || '',

      phone:
        user?.phone || '',

      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit =
    async (data) => {
      setLoading(true);

      try {
        const updateData = {
          name:
            data.name.trim(),
        };

        if (
          data.email.trim()
        ) {
          updateData.email =
            data.email.trim();
        }

        if (
          data.phone.trim()
        ) {
          updateData.phone =
            data.phone.trim();
        }

        if (
          data.currentPassword &&
          data.newPassword
        ) {
          updateData.currentPassword =
            data.currentPassword;

          updateData.newPassword =
            data.newPassword;
        }

        const response =
          await api.put(
            '/api/user/profile',
            updateData
          );

        updateUser(
          response.data
        );

        success(
          'Profile updated successfully!'
        );

        setValue(
          'currentPassword',
          ''
        );

        setValue(
          'newPassword',
          ''
        );

        setValue(
          'confirmNewPassword',
          ''
        );
      } catch (err) {
        toastError(
          err.response?.data
            ?.message ||
            'Failed to update profile'
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div>
      <PageHeader
        title="Account Settings"
        subtitle="Update your profile details or change your password."
      />

      <form
        onSubmit={
          handleSubmit(
            onSubmit
          )
        }
        className="mx-auto max-w-2xl space-y-8"
      >
        <section className="card rounded-3xl p-8 sm:p-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Profile
          </h2>

          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Keep at least one
            login method: email
            or phone number.
          </p>

          <div className="mt-8 space-y-6">
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
          </div>
        </section>

        <section className="card rounded-3xl p-8 sm:p-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Change password
          </h2>

          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Leave these fields
            blank to keep your
            existing password.
          </p>

          <div className="mt-8 space-y-6">
            <Field
              id="currentPassword"
              label="Current password"
              type="password"
              placeholder="••••••••"
              error={
                errors
                  .currentPassword
                  ?.message
              }
              {...register(
                'currentPassword'
              )}
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                id="newPassword"
                label="New password"
                type="password"
                placeholder="••••••••"
                error={
                  errors
                    .newPassword
                    ?.message
                }
                {...register(
                  'newPassword'
                )}
              />

              <Field
                id="confirmNewPassword"
                label="Confirm new password"
                type="password"
                placeholder="••••••••"
                error={
                  errors
                    .confirmNewPassword
                    ?.message
                }
                {...register(
                  'confirmNewPassword'
                )}
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pb-4">
          <button
            type="submit"
            disabled={loading}
            className={
              btnSmPrimary
            }
          >
            {loading
              ? 'Saving…'
              : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}