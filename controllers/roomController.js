import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

import crypto from "crypto";

export const createRoom = async (req, res) => {
  try {
    const { name, type } = req.body;

    const room = await prisma.room.create({
      data: {
        name,
        type,
        createdById: req.user.id,
      },
    });

    // ✅ VERY IMPORTANT → add creator as member
    await prisma.roomMember.create({
      data: {
        userId: req.user.id,
        roomId: room.id,
      },
    });

    let inviteLink = null;
    const FRONTEND_URL = "http://localhost:5173";
    if (type === "PRIVATE") {
      const token = crypto.randomBytes(16).toString("hex");

      const invite = await prisma.inviteLink.create({
        data: {
          token,
          roomId: room.id,
        },
      });

      inviteLink = `${FRONTEND_URL}/privateroom/${invite.token}`;
    } else {
      inviteLink = `${FRONTEND_URL}/publicroom/${room.id}`;
    }

    res.json({
      message: "Room created",
      room,
      inviteLink,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Room creation failed" });
  }
};

// GET ALL PUBLIC ROOMS
export const getPublicRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        type: "PUBLIC",
      },
      include: {
        members: true, // for count
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formatted = rooms.map(room => ({
      id: room.id,
      name: room.name,
      online: room.members.length,
    }));

    res.json({ rooms: formatted });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch public rooms" });
  }
};

// GET USER ROOMS (dashboard)
export const getUserRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    const rooms = await prisma.roomMember.findMany({
      where: {
        userId,
      },
      include: {
        room: true,
      },
    });

    const formatted = rooms.map(r => ({
      id: r.room.id,
      name: r.room.name,
      type: r.room.type,
    }));

    res.json({ rooms: formatted });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch user rooms" });
  }
};
export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    // 1. Validation check
    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    // 2. Optimized Fetch
    const messages = await prisma.message.findMany({
      where: { roomId: roomId },
      include: { 
        sender: {
          select: { username: true } // Only fetch what we need to speed it up
        } 
      },
      orderBy: { createdAt: "asc" },
      take: 50, // 3. Limit to last 50 messages to ensure it loads FAST
    });

    res.json({ messages });
  } catch (err) {
    // 4. Critical: Log the actual error to your console so you can debug it
    console.error("❌ Database Error in getMessages:", err.message);
    res.status(500).json({ 
      message: "Error fetching messages", 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

// Add this new function to roomController.js
export const getRoomByToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    const invite = await prisma.inviteLink.findUnique({
      where: { token },
      include: { room: true }
    });

    if (!invite) {
      return res.status(404).json({ message: "Invalid or expired invite link" });
    }

    res.json({ roomId: invite.room.id, roomName: invite.room.name });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


// Add this to the bottom of your roomController.js

export const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // 1. Find the room to verify ownership
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // 2. Security Check: Only the creator can delete the room
    if (room.createdById !== userId) {
      return res.status(403).json({ message: "Access Denied: Only the creator can delete this room." });
    }

    // 3. Safe Deletion: Use a transaction to delete all related data first
    // This prevents Prisma Foreign Key constraint errors
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { roomId } }),
      prisma.inviteLink.deleteMany({ where: { roomId } }),
      prisma.roomMember.deleteMany({ where: { roomId } }),
      prisma.room.delete({ where: { id: roomId } }),
    ]);

    res.json({ message: "Room permanently deleted from orbit." });
  } catch (err) {
    console.error("Delete Room Error:", err);
    res.status(500).json({ message: "Failed to delete room" });
  }
};