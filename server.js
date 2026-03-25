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

// ✅ CORS
const CLIENT_URL = "http://localhost:5173";

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);


app.get("/", (req, res) => {
  res.send("API Running 🚀");
});


//  SOCKET.IO SETUP
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

// 🔥 SOCKET AUTH
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("No token"));
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    socket.user = decoded; 
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});



//  SOCKET LOGIC
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  //  join room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
  });

  //  send message (SECURE)
  socket.on("sendMessage", async ({ roomId, message }) => {
    try {
      const saved = await prisma.message.create({
        data: {
          content: message,
          roomId,
          senderId: socket.user.id, // 🔥 from token (NOT frontend)
        },
        include: {
          sender: true,
        },
      });

      io.to(roomId).emit("receiveMessage", {
        id: saved.id,
        text: saved.content,
        user: saved.sender.username,
      });

    } catch (err) {
      console.error("Socket error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});


// ! START SERVER
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});