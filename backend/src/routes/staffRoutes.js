const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { auth } = require("../middleware/auth");
const c = require("../controllers/staffController");
const router = express.Router();
router.use(auth);
router.use((req, res, next) =>
  ["HQ_ADMIN", "BRANCH_MANAGER", "OPERATOR"].includes(req.user.role)
    ? next()
    : res
        .status(403)
        .json({
          message: "Staff management requires a manager or operator account",
        }),
);
const importLimit = rateLimit({
  windowMs: 60000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
router.get("/", c.list);
router.post("/", importLimit, c.create);
router.post("/import", importLimit, c.importCsv);
router.get(
  "/operators",
  (req, res, next) =>
    req.user.role === "HQ_ADMIN" ? next() : res.sendStatus(403),
  c.operators,
);
router.post(
  "/operators",
  importLimit,
  (req, res, next) =>
    req.user.role === "HQ_ADMIN" ? next() : res.sendStatus(403),
  c.createOperator,
);
router.patch("/:id", c.update);
module.exports = router;
