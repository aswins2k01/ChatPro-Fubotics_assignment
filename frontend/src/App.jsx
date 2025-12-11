
import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import "./App.css";

const NEW_SESSION_ID = "new";

function App() {
  // --- State ---
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(NEW_SESSION_ID);
  const [message, setMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const isSendingRef = useRef(false);

  // --- Fetch Sessions ---
  const fetchSessions = useCallback(async () => {
    try {
      const res = await axios.get("https://chatpro-fubotics-assignment.onrender.com");
      setSessions(res.data);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  }, []);

  // --- Fetch Messages ---
  const fetchMessages = useCallback(async (sessionId) => {
    if (sessionId === NEW_SESSION_ID) {
      setMessages([]);
      return;
    }
    try {
      const res = await axios.get(`https://chatpro-fubotics-assignment.onrender.com/${sessionId}`);
      const formatted = res.data.map(msg => ({
        sender: msg.sender,
        text: msg.content,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }));
      setMessages(formatted);
    } catch (err) {
      console.error(`Error fetching messages for session ${sessionId}:`, err);
      setMessages([]);
    }
  }, []);

  // --- Restore Active Session on Mount ---
  useEffect(() => {
    const restoreSession = async () => {
      await fetchSessions(); // load sessions first
      const savedSessionId = localStorage.getItem("activeSessionId");
      if (savedSessionId) {
        setActiveSessionId(savedSessionId);
        fetchMessages(savedSessionId);
      }
    };
    restoreSession();
  }, [fetchMessages, fetchSessions]);

  // --- Auto-scroll ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [messages, activeSessionId]);

  // --- Handlers ---
  const handleSessionClick = (sessionId) => {
    if (sessionId === NEW_SESSION_ID) return;
    if (sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
      fetchMessages(sessionId);
      setIsSidebarOpen(false);
      localStorage.setItem("activeSessionId", sessionId);
    }
  };

  const startNewSession = () => {
    setActiveSessionId(NEW_SESSION_ID);
    setMessages([]);
    localStorage.setItem("activeSessionId", NEW_SESSION_ID);
  };

  // App.jsx (CORRECTED sendMessage function)
const sendMessage = async () => {
    if (!message.trim()) return;

    let currentId = activeSessionId;
    let isNewSession = false;

    if (currentId === NEW_SESSION_ID) {
      currentId = Date.now().toString();
      // You set the state here:
      setActiveSessionId(currentId); 
      localStorage.setItem("activeSessionId", currentId);
      isNewSession = true; // mark this as new
    }

    // ... (rest of the user message and state updates) ...

    try {
      // 1. POST the message to the backend (where it saves to MongoDB)
      const res = await axios.post(`https://chatpro-fubotics-assignment.onrender.com/send/${currentId}`, { message: input });

      // ... (AI message added to state) ...

      // 2. Refresh sessions (sidebar titles)
      await fetchSessions(); // This is correct, it updates the sidebar list

      // 3. CRITICAL FIX: Explicitly fetch the messages for the newly active session
      // This ensures the messages are re-loaded immediately from the DB,
      // confirming persistence and clearing any temporary state issues.
      if (isNewSession) {
        await fetchMessages(currentId); 
      }
      
      // We don't need the final 'finally' block setting the focus twice
    } catch (err) {
      // ... (error handling remains the same) ...
    } finally {
      isSendingRef.current = false;
      setTyping(false); // Make sure typing is set to false here or after successful AI message
      setTimeout(() => inputRef.current?.focus(), 0);
    }
};

  const handleKeyDown = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  // --- Render ---
  const currentSessionTitle =
    sessions.find(s => s.id === activeSessionId)?.title ||
    (activeSessionId === NEW_SESSION_ID ? "New Conversation" : "Loading...");

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <div className={`sidebar ${isSidebarOpen ? "open" : "closed"}`} onClick={e => e.stopPropagation()}>
        <div style={{ paddingBottom: "10px" }}>
          <button
            className={`new-chat-btn ${activeSessionId === NEW_SESSION_ID ? "active" : ""}`}
            onClick={startNewSession}
          >
            <span style={{ fontSize: "18px" }}>&#x2728;</span> New Conversation
          </button>
        </div>
        <div className="history-label">Previous Chats</div>
        {sessions.map(session => (
          <div key={session.id} className="history-item-wrapper">
            <div
              className="history-item"
              style={session.id === activeSessionId ? { backgroundColor: "#e6eaf0", fontWeight: "bold" } : {}}
              onClick={() => handleSessionClick(session.id)}
            >
              {session.title}
            </div>
            <button
              className="delete-btn"
              onClick={async e => {
                e.stopPropagation();
                try {
                  await axios.delete(`https://chatpro-fubotics-assignment.onrender.com/sessions/${session.id}`);
                  setSessions(prev => prev.filter(s => s.id !== session.id));
                  if (activeSessionId === session.id) startNewSession();
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
        <div className="chat-header">
          <button
            className="menu-btn"
            onMouseDown={e => {
              e.stopPropagation();
              setIsSidebarOpen(prev => !prev);
            }}
          >
            {isSidebarOpen ? "✕" : "☰"}
          </button>
          <span>{currentSessionTitle}</span>
        </div>

        <div className="chat-scroll-area">
          <div className="chat-container">
            {messages.length === 0 && activeSessionId === NEW_SESSION_ID && (
              <div style={{ textAlign: "center", marginTop: "100px", color: "#aaa" }}>
                Start a new conversation to begin.
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <div>{msg.text}</div>
                <span className="message-time">{msg.time}</span>
              </div>
            ))}
            {typing && (
              <div className="message ai">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <input
              ref={inputRef}
              className="chat-input"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyDown={handleKeyDown}
            />
            <button className="send-btn" onClick={sendMessage} disabled={!message.trim() || typing}>
              &#x27A4;
            </button>
          </div>
          <div className="disclaimer">AI can make mistakes. Consider checking important information.</div>
        </div>
      </div>
    </div>
  );
}

export default App;
