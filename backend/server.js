// // server.js
// const express = require("express");
// const cors = require("cors");
// const bodyParser = require("body-parser");
// const fs = require("fs");
// require("dotenv").config();

// const { OpenAI } = require("openai");

// const app = express();
// app.use(cors());
// app.use(bodyParser.json());

// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
// });

// // --- Session Management Functions ---

// const CHAT_FILE = "sessions.json";

// // Loads ALL chat sessions
// function loadSessions() {
//     if (!fs.existsSync(CHAT_FILE)) return [];
//     try {
//         return JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
//     } catch (e) {
//         console.error("Error reading or parsing sessions.json:", e);
//         return [];
//     }
// }

// // Saves ALL chat sessions
// function saveSessions(data) {
//     fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));
// }

// // Generates a simple title for a new session
// function generateTitle(messages) {
//     const firstMessage = messages.find(m => m.role === 'user')?.content || "New Chat";
//     // Simple title generation
//     return firstMessage.substring(0, 30) + (firstMessage.length > 30 ? "..." : "");
// }


// // --- API Endpoints ---
// // 1. Get all sessions (for the sidebar)
// app.get("/sessions", (req, res) => {
//     const sessions = loadSessions().map(session => ({
//         id: session.id,
//         title: session.title,
//         date: session.date || new Date(parseInt(session.id)).toLocaleDateString()
//     }));
//     // Return newest chats first
//     res.json(sessions.sort((a, b) => parseInt(b.id) - parseInt(a.id))); 
// });

// // 2. Get messages for a specific session
// app.get("/sessions/:id", (req, res) => {
//     const sessionId = req.params.id;
//     const sessions = loadSessions();
//     const session = sessions.find(s => s.id === sessionId);

//     if (session) {
//         res.json(session.messages);
//     } else {
//         res.status(404).json({ error: "Session not found" });
//     }
// });

// // 3. POST send message + AI reply
// app.post("/send/:id", async (req, res) => {
//     const sessionId = req.params.id;
//     const userMessage = req.body.message;

//     const sessions = loadSessions();
//     let sessionIndex = sessions.findIndex(s => s.id === sessionId);
//     let session = sessions[sessionIndex];

//     // If session doesn't exist (i.e., first message in a "new chat")
//     if (!session) {
//         session = {
//             id: sessionId,
//             title: "New Chat",
//             date: new Date().toLocaleDateString(),
//             messages: []
//         };
//         sessions.push(session);
//         sessionIndex = sessions.length - 1;
//     }

//     // Add user message to session history
//     session.messages.push({ role: "user", sender: "user", content: userMessage });

//     try {
//         // Prepare messages for OpenAI, using the full chat history for context
//         const openAIMessages = session.messages.map(msg => ({
//             role: msg.role,
//             content: msg.content,
//         }));
        
//         // --- Correct OpenAI API Call ---
//         const completion = await openai.chat.completions.create({
//             model: "gpt-4o-mini", // Using the model that works for you
//             messages: openAIMessages,
//         });

//         const reply = completion.choices[0].message.content;

//         // Add AI reply to session history
//         session.messages.push({ role: "assistant", sender: "ai", content: reply });

//         // Update the session title after the first message
//         if (session.title === "New Chat") {
//             session.title = generateTitle(session.messages);
//         }

//         // Save updated sessions
//         saveSessions(sessions);

//         // Send back the reply text
//         res.json({ reply });
//     } catch (error) {
//         console.error("AI Request Failed:", error.response?.data || error.message);
        
//         // Remove the user message if the AI failed to respond
//         session.messages.pop(); 
//         saveSessions(sessions);
//         res.status(500).json({ error: "AI request failed" });
//     }
// });

// // DELETE a session
// app.delete("/sessions/:id", (req, res) => {
//     const sessionId = req.params.id;
//     let sessions = loadSessions();
//     const index = sessions.findIndex(s => s.id === sessionId);
//     if (index !== -1) {
//         sessions.splice(index, 1);
//         saveSessions(sessions);
//         res.json({ success: true });
//     } else {
//         res.status(404).json({ error: "Session not found" });
//     }
// });


// // Start server
// app.listen(5000, () => {
//     console.log("Backend running on port 5000");
// });




// server.js (MONGO-DB REPLACEMENT)
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
// const fs = require("fs"); // <-- REMOVED: Using MongoDB instead
const mongoose = require("mongoose"); // <-- NEW
require("dotenv").config();

const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- MongoDB Connection ---
// MONGO_URI will be loaded from the Render Environment Variable
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI environment variable is not set.");
    // In a production environment, you would exit the process here.
}

mongoose.connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.error("MongoDB Connection Error:", err.message));


// --- MongoDB Schema and Model ---
const MessageSchema = new mongoose.Schema({
    role: String, // 'user' or 'assistant'
    sender: String, // 'user' or 'ai'
    content: String,
}, { _id: false }); // We don't need Mongoose IDs for sub-documents

const SessionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Used to match the Frontend's timestamp ID
    title: String,
    date: { type: Date, default: Date.now },
    messages: [MessageSchema],
});

const Session = mongoose.model("Session", SessionSchema);


// --- OpenAI Setup ---
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Generates a simple title for a new session
function generateTitle(messages) {
    const firstMessage = messages.find(m => m.role === 'user')?.content || "New Chat";
    return firstMessage.substring(0, 30) + (firstMessage.length > 30 ? "..." : "");
}


// --- API Endpoints ---
// 1. Get all sessions (for the sidebar)
app.get("/sessions", async (req, res) => {
    try {
        const sessions = await Session.find()
            .select('id title date')
            .sort({ date: -1 }); // Sort by newest first
        res.json(sessions);
    } catch (error) {
        console.error("Error fetching sessions:", error);
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

// 2. Get messages for a specific session
app.get("/sessions/:id", async (req, res) => {
    const sessionId = req.params.id;
    try {
        const session = await Session.findOne({ id: sessionId });
        if (session) {
            res.json(session.messages);
        } else {
            res.status(404).json({ error: "Session not found" });
        }
    } catch (error) {
        console.error(`Error fetching messages for session ${sessionId}:`, error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// 3. POST send message + AI reply
app.post("/send/:id", async (req, res) => {
    const sessionId = req.params.id;
    const userMessage = req.body.message;

    let session = await Session.findOne({ id: sessionId });
    let isNewSession = false;

    // If session doesn't exist (i.e., first message in a "new chat")
    if (!session) {
        session = new Session({
            id: sessionId,
            title: "New Chat",
            messages: []
        });
        isNewSession = true;
    }

    // Add user message to session history
    const userMsgObj = { role: "user", sender: "user", content: userMessage };
    session.messages.push(userMsgObj);

    try {
        // Prepare messages for OpenAI, using the full chat history for context
        const openAIMessages = session.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: openAIMessages,
        });

        const reply = completion.choices[0].message.content;

        // Add AI reply to session history
        const aiMsgObj = { role: "assistant", sender: "ai", content: reply };
        session.messages.push(aiMsgObj);

        // Update the session title after the first message
        if (isNewSession) {
            session.title = generateTitle(session.messages);
        }

        // --- SAVE TO MONGODB ---
        await session.save();

        // Send back the reply text
        res.json({ reply });
    } catch (error) {
        console.error("AI Request Failed or Database Save Failed:", error.response?.data || error.message);
        
        // Error handling: Remove the user message if the AI request failed
        session.messages.pop(); 
        
        // Don't attempt save if the connection itself failed, but try otherwise
        if (!isNewSession) {
             // Save the state without the last user message
             try {
                await session.save();
             } catch (dbError) {
                 console.error("Failed to save session after AI error:", dbError);
             }
        }

        res.status(500).json({ error: "AI request failed or internal server error" });
    }
});

// 4. DELETE a session (New Endpoint)
app.delete("/sessions/:id", async (req, res) => {
    const sessionId = req.params.id;
    try {
        const result = await Session.deleteOne({ id: sessionId });
        if (result.deletedCount > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Session not found" });
        }
    } catch (error) {
        console.error("Error deleting session:", error);
        res.status(500).json({ error: "Failed to delete session" });
    }
});


// Start server
app.listen(5000, () => {
    console.log("Backend running on port 5000");
});