import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../config/prisma.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const summarizeRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const messages = await prisma.message.findMany({
      where: { roomId: roomId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { sender: true },
    });

    if (messages.length === 0) {
      return res.status(200).json({ summary: "No transmissions found in this sector yet." });
    }

    const chatLog = messages.reverse().map(m => `${m.sender.username}: ${m.content}`).join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      You are OrbitBot, an AI assistant on a space-themed chat platform.
      Read the following chat log and provide a very brief, 3-bullet-point summary of the main topics discussed.
      Do not invent any information. Keep the tone slightly sci-fi.
      
      Chat Log:
      ${chatLog}
    `;

    const result = await model.generateContent(prompt);
    
    res.status(200).json({ summary: result.response.text() });

  } catch (error) {
    console.error("Summarize Error:", error);
    res.status(500).json({ summary: "Communications array offline. Cannot generate summary." });
  }
};

export const askBot = async (req, res) => {
  try {
    const { prompt, currentUrl } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let chatContext = "";

    // Check if the user is currently inside a room based on their URL
    if (currentUrl && currentUrl.includes("room/")) {
      const urlParts = currentUrl.split("/");
      const idOrToken = urlParts[urlParts.length - 1]; // Grabs the ID or Token from the URL

      let realRoomId = null;

      // 1. Check if the URL parameter is a valid UUID (Public Room)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrToken);

      if (isUUID) {
        realRoomId = idOrToken;
      } else {
        // 2. If it's not a UUID, it must be a Private Room invite token
        // We must query the InviteLink table, NOT the Room table!
        const invite = await prisma.inviteLink.findUnique({
          where: { token: idOrToken }
        });
        
        if (invite) {
          realRoomId = invite.roomId;
        }
      }

      // If we successfully found the room ID, fetch the messages
      if (realRoomId) {
        const messages = await prisma.message.findMany({
          where: { roomId: realRoomId },
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: { sender: true },
        });

        if (messages.length > 0) {
          const chatLog = messages.reverse().map(m => `${m.sender.username}: ${m.content}`).join("\n");
          chatContext = `\n\n--- CURRENT ROOM CHAT LOG ---\n${chatLog}\n---------------------------`;
        }
      }
    }

    const systemPrompt = `
      You are OrbitBot, the helpful AI assistant for a real-time, space-themed chat platform called Orbit. 
      Keep your answers short, friendly, and under 3 sentences. 
      If the user asks for a summary or asks about the chat, use the "CURRENT ROOM CHAT LOG" provided below to answer them accurately. Do not invent information.
    `;

    const finalPrompt = `${systemPrompt}${chatContext}\n\nUser asks: ${prompt}`;

    const result = await model.generateContent(finalPrompt);
    
    res.status(200).json({ reply: result.response.text() });

  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ reply: "Communications array is down. Try again later." });
  }
};