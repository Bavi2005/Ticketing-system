import { useState } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../components/AuthLayout';
import { Field, Button, Alert } from '../components/ui';

const AdminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function AdminLogin() {
  const { login } = useAdmin();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(AdminLoginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      await login(data);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      admin
      title="Admin Console"
      subtitle="Sign in to review receipts, manage vouchers, and track performance."
      headline="Run your loyalty engine from one place."
      brandPoints={[
        'Review and approve receipts in seconds',
        'Real-time analytics on spend and engagement',
        'Full control over users, vouchers and rewards',
      ]}
      footer={
        <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            ← Back to member sign in
          </Link>
        </p>
      }
    >
      {error && <Alert>{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Field
          id="email"
          label="Email"
          type="email"
          placeholder="admin@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={loading} loadingText="Signing in…">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
