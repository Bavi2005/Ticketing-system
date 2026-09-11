const bcrypt =
  require('bcryptjs');

const fs =
  require('fs/promises');

const prisma =
  require('../utils/prisma');

async function removeUploadedFile(
  file
) {
  if (!file?.path) return;

  try {
    await fs.unlink(
      file.path
    );
  } catch {
    // File may already be gone.
  }
}

exports.getDashboard =
  async (req, res, next) => {
    try {
      const userId =
        req.user.id;

      const [
        pendingReceipts,
        approvedReceipts,
        availableVouchers,
        totalSpent,
      ] =
        await Promise.all([
          prisma.receipt.count(
            {
              where: {
                userId,
                status:
                  'PENDING',
              },
            }
          ),

          prisma.receipt.count(
            {
              where: {
                userId,
                status:
                  'APPROVED',
              },
            }
          ),

          prisma.voucher.count(
            {
              where: {
                userId,
                redeemedAt:
                  null,

                OR: [
                  {
                    expiresAt:
                      null,
                  },
                  {
                    expiresAt: {
                      gte:
                        new Date(),
                    },
                  },
                ],
              },
            }
          ),

          prisma.receipt.aggregate(
            {
              where: {
                userId,
                status:
                  'APPROVED',
              },

              _sum: {
                amount: true,
              },
            }
          ),
        ]);

      res.json({
        pendingReceipts,
        approvedReceipts,
        availableVouchers,

        totalSpent:
          totalSpent._sum
            .amount || 0,
      });
    } catch (error) {
      next(error);
    }
  };

exports.getReceipts =
  async (req, res, next) => {
    try {
      const userId =
        req.user.id;

      const receipts =
        await prisma.receipt.findMany(
          {
            where: {
              userId,
            },

            include: {
              voucher: true,
            },

            orderBy: {
              submittedAt:
                'desc',
            },
          }
        );

      res.json(receipts);
    } catch (error) {
      next(error);
    }
  };

exports.getVouchers =
  async (req, res, next) => {
    try {
      const userId =
        req.user.id;

      const vouchers =
        await prisma.voucher.findMany(
          {
            where: {
              userId,
            },

            include: {
              receipt: true,
            },

            orderBy: {
              issuedAt:
                'desc',
            },
          }
        );

      res.json(vouchers);
    } catch (error) {
      next(error);
    }
  };

exports.redeemVoucher =
  async (req, res, next) => {
    try {
      const userId =
        req.user.id;

      const { id } =
        req.params;

      const now =
        new Date();

      // Atomic claim: only an owned, unredeemed,
      // unexpired voucher can be changed.
      const result =
        await prisma.voucher.updateMany(
          {
            where: {
              id,
              userId,

              redeemedAt:
                null,

              OR: [
                {
                  expiresAt:
                    null,
                },
                {
                  expiresAt: {
                    gte: now,
                  },
                },
              ],
            },

            data: {
              redeemedAt: now,
            },
          }
        );

      if (
        result.count === 0
      ) {
        const voucher =
          await prisma.voucher.findUnique(
            {
              where: {
                id,
              },
            }
          );

        if (
          !voucher ||
          voucher.userId !==
            userId
        ) {
          return res
            .status(404)
            .json({
              message:
                'Voucher not found',
            });
        }

        if (
          voucher.redeemedAt
        ) {
          return res
            .status(400)
            .json({
              message:
                'Voucher has already been redeemed',
            });
        }

        if (
          voucher.expiresAt &&
          voucher.expiresAt <
            now
        ) {
          return res
            .status(400)
            .json({
              message:
                'Voucher has expired',
            });
        }

        return res
          .status(409)
          .json({
            message:
              'Voucher could not be redeemed',
          });
      }

      const updated =
        await prisma.voucher.findUnique(
          {
            where: {
              id,
            },

            include: {
              receipt: true,
            },
          }
        );

      res.json({
        message:
          'Voucher redeemed successfully',

        voucher:
          updated,
      });
    } catch (error) {
      next(error);
    }
  };

exports.updateProfile =
  async (req, res, next) => {
    try {
      const userId =
        req.user.id;

      const {
        name,
        email,
        phone,
        currentPassword,
        newPassword,
      } = req.body;

      const user =
        await prisma.user.findUnique(
          {
            where: {
              id: userId,
            },
          }
        );

      if (!user) {
        return res
          .status(404)
          .json({
            message:
              'User not found',
          });
      }

      const normalizedName =
        typeof name === 'string'
          ? name.trim()
          : undefined;

      const normalizedEmail =
        typeof email ===
        'string'
          ? email
              .trim()
              .toLowerCase()
          : undefined;

      const normalizedPhone =
        phone === undefined
          ? undefined
          : phone.trim() ||
            null;

      if (
        normalizedEmail &&
        normalizedEmail !==
          user.email
      ) {
        const existing =
          await prisma.user.findUnique(
            {
              where: {
                email:
                  normalizedEmail,
              },
            }
          );

        if (existing) {
          return res
            .status(409)
            .json({
              message:
                'Email already in use',
            });
        }
      }

      if (
        normalizedPhone &&
        normalizedPhone !==
          user.phone
      ) {
        const existing =
          await prisma.user.findUnique(
            {
              where: {
                phone:
                  normalizedPhone,
              },
            }
          );

        if (existing) {
          return res
            .status(409)
            .json({
              message:
                'Phone number already in use',
            });
        }
      }

      const updateData = {};

      if (
        normalizedName !==
        undefined
      ) {
        updateData.name =
          normalizedName;
      }

      if (
        normalizedEmail !==
        undefined
      ) {
        updateData.email =
          normalizedEmail;
      }

      if (
        normalizedPhone !==
        undefined
      ) {
        updateData.phone =
          normalizedPhone;
      }

      if (
        currentPassword &&
        newPassword
      ) {
        const isValid =
          await bcrypt.compare(
            currentPassword,
            user.passwordHash
          );

        if (!isValid) {
          return res
            .status(401)
            .json({
              message:
                'Current password is incorrect',
            });
        }

        updateData.passwordHash =
          await bcrypt.hash(
            newPassword,
            12
          );
      }

      const updatedUser =
        await prisma.user.update(
          {
            where: {
              id: userId,
            },

            data:
              updateData,

            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              createdAt: true,
            },
          }
        );

      res.json(
        updatedUser
      );
    } catch (error) {
      next(error);
    }
  };

exports.uploadReceipt =
  async (req, res, next) => {
    let receiptCreated =
      false;

    try {
      const userId =
        req.user.id;

      const {
        orderId,
        purchaseDate,
        amount,
      } = req.body;

      if (!req.file) {
        return res
          .status(400)
          .json({
            message:
              'Receipt file is required',
          });
      }

      const normalizedOrderId =
        orderId.trim();

      const existing =
        await prisma.receipt.findFirst(
          {
            where: {
              userId,
              orderId:
                normalizedOrderId,
            },
          }
        );

      if (existing) {
        await removeUploadedFile(
          req.file
        );

        return res
          .status(409)
          .json({
            message:
              'Receipt with this Order ID already exists',
          });
      }

      const receipt =
        await prisma.receipt.create(
          {
            data: {
              userId,

              orderId:
                normalizedOrderId,

              purchaseDate:
                new Date(
                  purchaseDate
                ),

              amount:
                Number(amount),

              // Store the public URL path.
              imageUrl:
                `/uploads/${req.file.filename}`,

              status:
                'PENDING',
            },

            include: {
              voucher: true,
            },
          }
        );

      receiptCreated =
        true;

      res.status(201).json(
        receipt
      );
    } catch (error) {
      if (!receiptCreated) {
        await removeUploadedFile(
          req.file
        );
      }

      next(error);
    }
  };