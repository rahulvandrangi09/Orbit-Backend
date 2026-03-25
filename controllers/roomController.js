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

    if (type === "PRIVATE") {
      const token = crypto.randomBytes(16).toString("hex");

      const invite = await prisma.inviteLink.create({
        data: {
          token,
          roomId: room.id,
        },
      });

      inviteLink = `http://localhost:5173/privateroom/${invite.token}`;
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
    const messages = await prisma.message.findMany({
      where: { roomId: req.params.roomId },
      include: { sender: true },
      orderBy: { createdAt: "asc" },
    });

    res.json({messages});
  } catch (err) {
    res.status(500).json({ message: "Error fetching messages" });
  }
};
