const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { auth } = require("../middleware/auth");
const c = require("../controllers/staffController");
const router = express.Router();
router.use(auth);
router.use((req, res, next) =>
  ["OPERATOR", "HQ_ADMIN", "BRANCH_MANAGER"].includes(req.user.role)
    ? next()
    : res
        .status(403)
        .json({
          message: "Staff management requires an operator, HQ or site manager account",
        }),
);
const importLimit = rateLimit({
  windowMs: 60000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
router.get("/", c.list);
router.get("/technicians", c.technicians);
router.post("/assign-technician", importLimit, c.assignTechnician);
router.post("/", importLimit, c.create);
router.post("/import", importLimit, c.importCsv);
router.patch("/:id", c.update);
router.delete("/", (req, res, next) => req.user.role === "OPERATOR" ? next() : res.status(403).json({ message: "Only operators can delete users" }), importLimit, c.removeMany);
router.delete("/:id", (req, res, next) => req.user.role === "OPERATOR" ? next() : res.status(403).json({ message: "Only operators can delete users" }), importLimit, c.remove);
module.exports = router;
