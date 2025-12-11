// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
require("dotenv").config();

const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// --- Session Management Functions ---

const CHAT_FILE = "sessions.json";

// Loads ALL chat sessions
function loadSessions() {
    if (!fs.existsSync(CHAT_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
    } catch (e) {
        console.error("Error reading or parsing sessions.json:", e);
        return [];
    }
}

// Saves ALL chat sessions
function saveSessions(data) {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));
}

// Generates a simple title for a new session
function generateTitle(messages) {
    const firstMessage = messages.find(m => m.role === 'user')?.content || "New Chat";
    // Simple title generation
    return firstMessage.substring(0, 30) + (firstMessage.length > 30 ? "..." : "");
}


// --- API Endpoints ---
// 1. Get all sessions (for the sidebar)
app.get("/sessions", (req, res) => {
    const sessions = loadSessions().map(session => ({
        id: session.id,
        title: session.title,
        date: session.date || new Date(parseInt(session.id)).toLocaleDateString()
    }));
    // Return newest chats first
    res.json(sessions.sort((a, b) => parseInt(b.id) - parseInt(a.id))); 
});

// 2. Get messages for a specific session
app.get("/sessions/:id", (req, res) => {
    const sessionId = req.params.id;
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === sessionId);

    if (session) {
        res.json(session.messages);
    } else {
        res.status(404).json({ error: "Session not found" });
    }
});

// 3. POST send message + AI reply
app.post("/send/:id", async (req, res) => {
    const sessionId = req.params.id;
    const userMessage = req.body.message;

    const sessions = loadSessions();
    let sessionIndex = sessions.findIndex(s => s.id === sessionId);
    let session = sessions[sessionIndex];

    // If session doesn't exist (i.e., first message in a "new chat")
    if (!session) {
        session = {
            id: sessionId,
            title: "New Chat",
            date: new Date().toLocaleDateString(),
            messages: []
        };
        sessions.push(session);
        sessionIndex = sessions.length - 1;
    }

    // Add user message to session history
    session.messages.push({ role: "user", sender: "user", content: userMessage });

    try {
        // Prepare messages for OpenAI, using the full chat history for context
        const openAIMessages = session.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));
        
        // --- Correct OpenAI API Call ---
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Using the model that works for you
            messages: openAIMessages,
        });

        const reply = completion.choices[0].message.content;

        // Add AI reply to session history
        session.messages.push({ role: "assistant", sender: "ai", content: reply });

        // Update the session title after the first message
        if (session.title === "New Chat") {
            session.title = generateTitle(session.messages);
        }

        // Save updated sessions
        saveSessions(sessions);

        // Send back the reply text
        res.json({ reply });
    } catch (error) {
        console.error("AI Request Failed:", error.response?.data || error.message);
        
        // Remove the user message if the AI failed to respond
        session.messages.pop(); 
        saveSessions(sessions);
        res.status(500).json({ error: "AI request failed" });
    }
});

// DELETE a session
app.delete("/sessions/:id", (req, res) => {
    const sessionId = req.params.id;
    let sessions = loadSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
        sessions.splice(index, 1);
        saveSessions(sessions);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Session not found" });
    }
});


// Start server
app.listen(5000, () => {
    console.log("Backend running on port 5000");
});