const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { auth } = require("../middleware/auth");
const c = require("../controllers/staffController");
const router = express.Router();
router.use(auth);
router.use((req, res, next) =>
  req.user.role === "OPERATOR"
    ? next()
    : res
        .status(403)
        .json({
          message: "Credential management is restricted to the operator account",
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
router.patch("/:id", c.update);
module.exports = router;
