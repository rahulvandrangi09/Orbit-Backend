import express from "express";
import {
  createRoom,
  getPublicRooms,
  getUserRooms,
  getMessages,
  getRoomByToken,
  deleteRoom
} from "../controllers/roomController.js";

import {protect} from "../middleware/authMiddleware.js";

const router = express.Router();

// protected
router.post("/create", protect, createRoom);

// public
router.get("/public", getPublicRooms);

// protected
router.get("/my", protect, getUserRooms);

router.get("/:roomId/messages",protect , getMessages);

router.get("/token/:token", protect, getRoomByToken);

router.delete('/:roomId', protect, deleteRoom);


export default router;