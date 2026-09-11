const {
  registerSchema,
  loginSchema,
  uploadReceiptSchema,
  updateProfileSchema,
} = require(
  '../src/validators/schemas'
);

describe(
  'registerSchema',
  () => {
    it(
      'accepts email registration',
      async () => {
        const parsed =
          await registerSchema.parseAsync(
            {
              body: {
                name:
                  'Jane',

                email:
                  'jane@example.com',

                password:
                  'secret1',
              },

              query: {},
              params: {},
            }
          );

        expect(
          parsed.body.email
        ).toBe(
          'jane@example.com'
        );
      }
    );

    it(
      'accepts phone-only registration',
      async () => {
        const parsed =
          await registerSchema.parseAsync(
            {
              body: {
                name:
                  'Jane',

                phone:
                  '+60123456789',

                password:
                  'secret1',
              },

              query: {},
              params: {},
            }
          );

        expect(
          parsed.body.phone
        ).toBe(
          '+60123456789'
        );
      }
    );

    it(
      'rejects registration without email or phone',
      async () => {
        await expect(
          registerSchema.parseAsync(
            {
              body: {
                name:
                  'Jane',

                password:
                  'secret1',
              },

              query: {},
              params: {},
            }
          )
        ).rejects.toThrow();
      }
    );

    it(
      'rejects bad email when supplied',
      async () => {
        await expect(
          registerSchema.parseAsync(
            {
              body: {
                name:
                  'Jane',

                email:
                  'not-an-email',

                password:
                  'secret1',
              },

              query: {},
              params: {},
            }
          )
        ).rejects.toThrow();
      }
    );

    it(
      'rejects short password',
      async () => {
        await expect(
          registerSchema.parseAsync(
            {
              body: {
                email:
                  'a@b.com',

                password:
                  '123',
              },

              query: {},
              params: {},
            }
          )
        ).rejects.toThrow();
      }
    );
  }
);

describe(
  'loginSchema',
  () => {
    it(
      'accepts email login',
      async () => {
        const parsed =
          await loginSchema.parseAsync(
            {
              body: {
                email:
                  'jane@example.com',

                password:
                  'secret1',
              },

              query: {},
              params: {},
            }
          );

        expect(
          parsed.body.email
        ).toBe(
          'jane@example.com'
        );
      }
    );

    it(
      'accepts phone login',
      async () => {
        const parsed =
          await loginSchema.parseAsync(
            {
              body: {
                email:
                  '+60123456789',

                password:
                  'secret1',
              },

              query: {},
              params: {},
            }
          );

        expect(
          parsed.body.email
        ).toBe(
          '+60123456789'
        );
      }
    );
  }
);

describe(
  'uploadReceiptSchema',
  () => {
    it(
      'coerces amount string to number and validates positivity',
      async () => {
        const parsed =
          await uploadReceiptSchema.parseAsync(
            {
              body: {
                orderId:
                  'A1',

                purchaseDate:
                  '2026-08-30',

                amount:
                  '19.99',
              },

              query: {},
              params: {},
            }
          );

        expect(
          parsed.body.amount
        ).toBe(19.99);
      }
    );

    it(
      'rejects zero/negative amounts',
      async () => {
        await expect(
          uploadReceiptSchema.parseAsync(
            {
              body: {
                orderId:
                  'A1',

                purchaseDate:
                  '2026-08-30',

                amount:
                  '0',
              },

              query: {},
              params: {},
            }
          )
        ).rejects.toThrow();
      }
    );

    it(
      'rejects invalid date',
      async () => {
        await expect(
          uploadReceiptSchema.parseAsync(
            {
              body: {
                orderId:
                  'A1',

                purchaseDate:
                  'not-a-date',

                amount:
                  '10',
              },

              query: {},
              params: {},
            }
          )
        ).rejects.toThrow();
      }
    );
  }
);

describe(
  'updateProfileSchema',
  () => {
    it(
      'requires current password when changing password',
      async () => {
        await expect(
          updateProfileSchema.parseAsync(
            {
              body: {
                newPassword:
                  'newpassword1',
              },

              query: {},
              params: {},
            }
          )
        ).rejects.toThrow();
      }
    );

    it(
      'passes with both current and new password',
      async () => {
        const parsed =
          await updateProfileSchema.parseAsync(
            {
              body: {
                currentPassword:
                  'old12345',

                newPassword:
                  'new12345',
              },

              query: {},
              params: {},
            }
          );

        expect(
          parsed.body
            .newPassword
        ).toBe(
          'new12345'
        );
      }
    );
  }
);