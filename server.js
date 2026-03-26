import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { connectDB } from "./config/db.js";
import prisma from "./config/prisma.js";

import authRoutes from "./routes/authRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const CLIENT_URL = "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get("/", (req, res) => {
  res.send("Welcome to the Orbit Backend!");
});
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
});

// 🔥 ENHANCED SOCKET AUTH: Attach username to socket immediately
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token provided"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; 

    // Fetch username once and store it on the socket object
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return next(new Error("User not found"));
    
    socket.username = user.username; 
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// Memory store for tracking: socket.id -> { roomId, username }
const activeUsers = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.username} (${socket.id})`);

  // Helper to broadcast unique usernames in a specific room
  const broadcastRoomUsers = (roomId) => {
    const usersInRoom = Array.from(activeUsers.values())
      .filter(u => u.roomId === roomId)
      .map(u => u.username);
    
    io.to(roomId).emit("roomUsers", [...new Set(usersInRoom)]);
  };

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    activeUsers.set(socket.id, { roomId, username: socket.username });
    broadcastRoomUsers(roomId);
  });

  socket.on("typing", ({ roomId, username }) => {
    socket.to(roomId).emit("userTyping", { username });
  });

  socket.on("stopTyping", ({ roomId, username }) => {
    socket.to(roomId).emit("userStoppedTyping", { username });
  });

  socket.on("sendMessage", async ({ roomId, message }) => {
    try {
      const saved = await prisma.message.create({
        data: {
          content: message,
          roomId,
          senderId: socket.user.id, 
        },
        include: { sender: true },
      });

      // 🔥 FIX: 'socket.to' prevents the sender from getting a duplicate message
      socket.to(roomId).emit("receiveMessage", {
        id: saved.id,
        text: saved.content,
        user: saved.sender.username,
      });
    } catch (err) {
      console.error("Database save error:", err);
    }
  });

  socket.on("disconnect", () => {
    const userData = activeUsers.get(socket.id);
    if (userData) {
      const { roomId } = userData;
      activeUsers.delete(socket.id);
      broadcastRoomUsers(roomId);
    }
    console.log(`User disconnected: ${socket.username}`);
  });
});

const PORT = process.env.PORT || 3000; // Render will provide the PORT env var
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Orbit Server launched at port ${PORT}`);
});