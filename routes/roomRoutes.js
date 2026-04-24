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

router.post("/create", protect, createRoom);

router.get("/public", getPublicRooms);

router.get("/my", protect, getUserRooms);

router.get("/:roomId/messages",protect , getMessages);

router.get("/token/:token", protect, getRoomByToken);

router.delete('/:roomId', protect, deleteRoom);


export default router;