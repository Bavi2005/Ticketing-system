const express = require("express");
const { auth } = require("../middleware/auth");
const controller = require("../controllers/authController");
const router = express.Router();
router.post("/login", controller.login);
router.get("/me", auth, controller.me);
router.put("/profile", auth, controller.updateProfile);
module.exports = router;
