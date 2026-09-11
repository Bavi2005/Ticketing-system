const { z } = require('zod');

const optionalEmail = z.preprocess(
  (value) => {
    if (
      typeof value === 'string' &&
      value.trim() === ''
    ) {
      return undefined;
    }

    return value;
  },
  z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
);

const optionalPhone = z.preprocess(
  (value) => {
    if (
      typeof value === 'string' &&
      value.trim() === ''
    ) {
      return undefined;
    }

    return value;
  },
  z
    .string()
    .trim()
    .min(
      6,
      'Phone number must be at least 6 characters'
    )
    .max(
      30,
      'Phone number is too long'
    )
    .optional()
);

const registerSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(
          2,
          'Name must be at least 2 characters'
        )
        .optional(),

      email: optionalEmail,

      phone: optionalPhone,

      password: z
        .string()
        .min(
          6,
          'Password must be at least 6 characters'
        ),
    })
    .refine(
      (data) =>
        Boolean(
          data.email ||
          data.phone
        ),
      {
        message:
          'Email or phone number is required',
        path: ['email'],
      }
    ),
});

const loginSchema = z.object({
  body: z.object({
    // Kept as "email" in the API request for
    // backward compatibility, but it accepts
    // either an email address or phone number.
    email: z
      .string()
      .trim()
      .min(
        1,
        'Email or phone number is required'
      ),

    password: z
      .string()
      .min(
        1,
        'Password is required'
      ),
  }),
});

const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(
          2,
          'Name must be at least 2 characters'
        )
        .optional(),

      email: optionalEmail,

      phone: optionalPhone,

      currentPassword:
        z.string().optional(),

      newPassword: z
        .string()
        .min(
          6,
          'New password must be at least 6 characters'
        )
        .optional(),
    })
    .refine(
      (data) => {
        if (
          data.newPassword &&
          !data.currentPassword
        ) {
          return false;
        }

        return true;
      },
      {
        message:
          'Current password is required to change password',
        path: ['currentPassword'],
      }
    ),
});

const uploadReceiptSchema = z.object({
  body: z.object({
    orderId: z
      .string()
      .trim()
      .min(
        1,
        'Order ID is required'
      ),

    purchaseDate: z
      .string()
      .refine(
        (date) =>
          !Number.isNaN(
            Date.parse(date)
          ),
        'Invalid date format'
      ),

    amount: z.coerce
      .number()
      .positive(
        'Amount must be positive'
      ),
  }),
});

const adminLoginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email(
        'Invalid email address'
      ),

    password: z
      .string()
      .min(
        1,
        'Password is required'
      ),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  uploadReceiptSchema,
  adminLoginSchema,
};