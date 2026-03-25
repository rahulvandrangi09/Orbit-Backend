import express from "express";
import { signup, login, logout } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
// Example protected route
router.get("/me", protect, (req, res) => {
  res.json(req.user);
});

export default router;