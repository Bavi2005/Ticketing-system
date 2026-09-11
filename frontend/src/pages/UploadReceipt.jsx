import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, ReceiptText, Loader2, CheckCircle2, X } from 'lucide-react';
import { api as axios } from '../api';
import { useUser } from '../contexts/UserContext';
import { useToast, PageHeader, inputCls, labelCls, btnSmPrimary, btnGhost } from '../components/ui';
import { formatFileSize } from '../utils/formatters';

const UploadReceiptSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  amount: z.coerce.number().positive('Amount must be a positive number'),
});

const ACCEPTED = 'image/jpeg,image/png,application/pdf';

export default function UploadReceipt() {
  const { refreshStats } = useUser();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | uploading | success
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(UploadReceiptSchema),
    mode: 'onChange',
  });

  const today = new Date().toISOString().split('T')[0];

  const onSelectFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const okTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!okTypes.includes(f.type)) {
      setFileError('Only JPG, PNG or PDF files are accepted');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setFileError('File is too large (max 5 MB)');
      return;
    }
    setFileError(null);
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  const onSubmit = async (data) => {
    if (!file) {
      setFileError('Please attach a receipt image or PDF');
      return;
    }
    setStage('uploading');
    setError('');
    try {
      const formData = new FormData();
      formData.append('orderId', data.orderId);
      formData.append('purchaseDate', data.purchaseDate);
      formData.append('amount', data.amount);
      formData.append('receipt', file);

      await axios.post(`/api/user/receipts`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await refreshStats();
      success('Receipt submitted', 'We\'re reviewing it — you\'ll get a reward once approved.');
      setStage('success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Upload failed. Please try again.';
      setError(msg);
      toastError('Upload failed', msg);
      setStage('idle');
    }
  };

  const resetAll = () => {
    reset();
    removeFile();
    setError('');
    setStage('idle');
  };

  return (
    <div>
      <PageHeader
        title="Upload receipt"
        subtitle="Submit a photo of your purchase receipt — we&apos;ll review it and award your reward."
      />

      <div className="mx-auto max-w-2xl">
        <div className="card rounded-3xl p-6 sm:p-10">
          <AnimatePresence mode="wait">
            <motion.form
              key={stage === 'success' ? 'success' : 'form'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
            >
              {stage === 'success' ? (
                <SuccessView onUploadAnother={resetAll} />
              ) : (
                <>
                  {/* Drop zone / preview */}
                  <div>
                    <label className={labelCls}>Receipt photo or PDF</label>
                    <input
                      type="file"
                      accept={ACCEPTED}
                      onChange={onSelectFile}
                      className="sr-only"
                      id="receipt-file"
                      aria-describedby="receipt-hint"
                    />
                    {file ? (
                      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700">
                        {preview ? (
                          <img
                            src={preview}
                            alt="Receipt preview"
                            className="max-h-64 w-full bg-gray-50 object-contain dark:bg-slate-900/60"
                          />
                        ) : (
                          <div className="flex items-center justify-center bg-gray-50 p-10 dark:bg-slate-900/60">
                            <ReceiptText className="h-12 w-12 text-gray-300 dark:text-slate-600" />
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-4 border-t border-gray-100 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/40">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{file.name}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{formatFileSize(file.size)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label htmlFor="receipt-file" className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10">
                              Replace
                            </label>
                            <button type="button" onClick={removeFile} aria-label="Remove file" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-700 dark:hover:text-white">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="receipt-file"
                        className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10"
                      >
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 transition group-hover:scale-105 dark:bg-slate-900 dark:ring-slate-700">
                          <ImagePlus className="h-6 w-6 text-indigo-500" />
                        </span>
                        <p className="mt-4 text-[15px] font-semibold text-gray-900 dark:text-white">
                          Drag &amp; drop your receipt, or <span className="text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">browse</span>
                        </p>
                        <p id="receipt-hint" className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">JPG, PNG or PDF · up to 5 MB</p>
                      </label>
                    )}
                    {fileError && <p className="mt-2 text-[13px] font-medium text-rose-600">{fileError}</p>}
                  </div>

                  {/* Fields */}
                  <div>
                    <label htmlFor="orderId" className={labelCls}>Order ID</label>
                    <input id="orderId" type="text" className={inputCls} placeholder="e.g. ORD-100245" {...register('orderId')} />
                    {errors.orderId && <p className="mt-1.5 text-[13px] font-medium text-rose-600">{errors.orderId.message}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="purchaseDate" className={labelCls}>Purchase date</label>
                      <input id="purchaseDate" type="date" max={today} className={inputCls} {...register('purchaseDate')} />
                      {errors.purchaseDate && <p className="mt-1.5 text-[13px] font-medium text-rose-600">{errors.purchaseDate.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="amount" className={labelCls}>Amount</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">RM</span>
                        <input id="amount" type="number" step="0.01" min="0.01" className={`${inputCls} pl-11`} placeholder="0.00" {...register('amount')} />
                      </div>
                      {errors.amount && <p className="mt-1.5 text-[13px] font-medium text-rose-600">{errors.amount.message}</p>}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-100 pt-6 sm:flex-row dark:border-slate-700/60">
                    <button type="button" onClick={() => navigate('/dashboard')} className={btnGhost}>
                      Cancel
                    </button>
                    <button type="submit" disabled={stage === 'uploading'} className={btnSmPrimary}>
                      {stage === 'uploading' ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                      ) : (
                        'Submit for review'
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.form>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SuccessView({ onUploadAnother }) {
  return (
    <div className="py-6 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
      >
        <CheckCircle2 className="h-8 w-8" />
      </motion.div>
      <h2 className="mt-5 text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">Receipt submitted!</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-slate-400">
        Our team is reviewing it. Once approved, your reward will be added automatically.
      </p>
      <ol className="mx-auto mt-6 flex max-w-xs flex-col gap-3 text-left">
        {['Submitted for review', 'Under review', 'Reward issued'].map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-2 ${
              i === 0
                ? 'bg-emerald-500 text-white ring-emerald-200'
                : 'bg-white text-gray-400 ring-gray-200 dark:bg-slate-800 dark:ring-slate-700 dark:text-slate-500'
            }`}>{i === 0 ? '✓' : i + 1}</span>
            <span className={`text-sm ${i === 0 ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/receipt-history" className={btnSmPrimary}>View receipts</Link>
        <button onClick={onUploadAnother} className={btnGhost}>Upload another</button>
      </div>
    </div>
  );
}
