import express from "express";
import {
  createRoom,
  getPublicRooms,
  getUserRooms,
  getMessages,
  getRoomByToken,
  deleteRoom
} from "../controllers/roomController.js";
import {askBot, summarizeRoom} from "../controllers/botController.js";

import {protect} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", protect, createRoom);

router.get("/public", protect, getPublicRooms);

router.get("/my", protect, getUserRooms);

router.get("/:roomId/messages", protect, getMessages);

router.get("/token/:token", protect, getRoomByToken);

router.delete('/:roomId', protect, deleteRoom);

router.get('/:roomId/summarize', protect, summarizeRoom);

router.post('/:roomId/bot/ask', protect, askBot);

export default router;