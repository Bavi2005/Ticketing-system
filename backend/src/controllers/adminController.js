const prisma =
  require('../utils/prisma');

function httpError(
  status,
  message
) {
  const error =
    new Error(message);

  error.status = status;

  return error;
}

exports.getDashboard =
  async (req, res, next) => {
    try {
      const [
        pendingReceipts,
        approvedReceipts,
        rejectedReceipts,
        vouchersIssued,
      ] =
        await Promise.all([
          prisma.receipt.count(
            {
              where: {
                status:
                  'PENDING',
              },
            }
          ),

          prisma.receipt.count(
            {
              where: {
                status:
                  'APPROVED',
              },
            }
          ),

          prisma.receipt.count(
            {
              where: {
                status:
                  'REJECTED',
              },
            }
          ),

          prisma.voucher.count(),
        ]);

      res.json({
        pendingReceipts,
        approvedReceipts,
        rejectedReceipts,
        vouchersIssued,
      });
    } catch (error) {
      next(error);
    }
  };

exports.getReceipts =
  async (req, res, next) => {
    try {
      const {
        status,
        search,
        page = '1',
        limit = '10',
      } = req.query;

      const parsedPage =
        Number.parseInt(
          page,
          10
        );

      const parsedLimit =
        Number.parseInt(
          limit,
          10
        );

      const pageNum =
        Number.isFinite(
          parsedPage
        ) &&
        parsedPage > 0
          ? parsedPage
          : 1;

      const limitNum =
        Number.isFinite(
          parsedLimit
        ) &&
        parsedLimit > 0
          ? Math.min(
              50,
              parsedLimit
            )
          : 10;

      const skip =
        (pageNum - 1) *
        limitNum;

      const where = {};

      if (
        status &&
        [
          'PENDING',
          'APPROVED',
          'REJECTED',
        ].includes(status)
      ) {
        where.status =
          status;
      }

      const searchTerm =
        typeof search ===
        'string'
          ? search
              .trim()
              .slice(0, 100)
          : '';

      if (searchTerm) {
        where.OR = [
          {
            orderId: {
              contains:
                searchTerm,
              mode:
                'insensitive',
            },
          },

          {
            user: {
              name: {
                contains:
                  searchTerm,
                mode:
                  'insensitive',
              },
            },
          },

          {
            user: {
              email: {
                contains:
                  searchTerm,
                mode:
                  'insensitive',
              },
            },
          },
        ];
      }

      const [
        receipts,
        total,
      ] =
        await Promise.all([
          prisma.receipt.findMany(
            {
              where,

              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                  },
                },

                voucher: true,
              },

              orderBy: {
                submittedAt:
                  'desc',
              },

              skip,

              take:
                limitNum,
            }
          ),

          prisma.receipt.count(
            {
              where,
            }
          ),
        ]);

      res.json({
        receipts,

        pagination: {
          page:
            pageNum,

          limit:
            limitNum,

          total,

          totalPages:
            Math.max(
              1,
              Math.ceil(
                total /
                  limitNum
              )
            ),
        },
      });
    } catch (error) {
      next(error);
    }
  };

exports.approveReceipt =
  async (req, res, next) => {
    try {
      const { id } =
        req.params;

      const result =
        await prisma.$transaction(
          async (tx) => {
            // Read current state first.
            const receipt =
              await tx.receipt.findUnique(
                {
                  where: {
                    id,
                  },

                  include: {
                    voucher:
                      true,
                  },
                }
              );

            if (!receipt) {
              throw httpError(
                404,
                'Receipt not found'
              );
            }

            if (
              receipt.status ===
              'APPROVED'
            ) {
              return {
                receipt,
                voucher:
                  receipt.voucher,
                alreadyApproved:
                  true,
              };
            }

            if (
              receipt.status ===
              'REJECTED'
            ) {
              throw httpError(
                400,
                'Receipt is already rejected and cannot be approved'
              );
            }

            const reviewedAt =
              new Date();

            // Atomically claim this pending receipt.
            // Only one competing request can change
            // PENDING -> APPROVED.
            const claim =
              await tx.receipt.updateMany(
                {
                  where: {
                    id,
                    status:
                      'PENDING',
                  },

                  data: {
                    status:
                      'APPROVED',

                    reviewedAt,
                  },
                }
              );

            if (
              claim.count === 0
            ) {
              // Another request processed it while
              // this request was waiting.
              const current =
                await tx.receipt.findUnique(
                  {
                    where: {
                      id,
                    },

                    include: {
                      voucher:
                        true,
                    },
                  }
                );

              if (!current) {
                throw httpError(
                  404,
                  'Receipt not found'
                );
              }

              if (
                current.status ===
                'APPROVED'
              ) {
                return {
                  receipt:
                    current,

                  voucher:
                    current.voucher,

                  alreadyApproved:
                    true,
                };
              }

              throw httpError(
                400,
                `Receipt is already ${current.status.toLowerCase()}`
              );
            }

            const updatedReceipt =
              await tx.receipt.findUnique(
                {
                  where: {
                    id,
                  },
                }
              );

            const expiresAt =
              new Date();

            expiresAt.setDate(
              expiresAt.getDate() +
                90
            );

            const voucher =
              await tx.voucher.create(
                {
                  data: {
                    userId:
                      receipt.userId,

                    receiptId:
                      receipt.id,

                    expiresAt,
                  },
                }
              );

            return {
              receipt:
                updatedReceipt,

              voucher,

              alreadyApproved:
                false,
            };
          }
        );

      res.json({
        message:
          result.alreadyApproved
            ? 'Receipt was already approved — no new voucher created'
            : 'Receipt approved and voucher generated',

        receipt:
          result.receipt,

        voucher:
          result.voucher,
      });
    } catch (error) {
      next(error);
    }
  };

exports.rejectReceipt =
  async (req, res, next) => {
    try {
      const { id } =
        req.params;

      const receipt =
        await prisma.receipt.findUnique(
          {
            where: {
              id,
            },
          }
        );

      if (!receipt) {
        return res
          .status(404)
          .json({
            message:
              'Receipt not found',
          });
      }

      if (
        receipt.status !==
        'PENDING'
      ) {
        return res
          .status(400)
          .json({
            message:
              `Receipt is already ${receipt.status.toLowerCase()}`,
          });
      }

      const claim =
        await prisma.receipt.updateMany(
          {
            where: {
              id,
              status:
                'PENDING',
            },

            data: {
              status:
                'REJECTED',

              reviewedAt:
                new Date(),
            },
          }
        );

      if (
        claim.count === 0
      ) {
        const current =
          await prisma.receipt.findUnique(
            {
              where: {
                id,
              },
            }
          );

        if (!current) {
          return res
            .status(404)
            .json({
              message:
                'Receipt not found',
            });
        }

        return res
          .status(400)
          .json({
            message:
              `Receipt is already ${current.status.toLowerCase()}`,
          });
      }

      const updatedReceipt =
        await prisma.receipt.findUnique(
          {
            where: {
              id,
            },
          }
        );

      res.json({
        message:
          'Receipt rejected',

        receipt:
          updatedReceipt,
      });
    } catch (error) {
      next(error);
    }
  };