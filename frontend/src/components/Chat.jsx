import { useEffect, useState, useRef } from "react";
import api from "../services/api";

export default function Chat({ threadId, userId }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const fetchMessages = async () => {
    if (!threadId) return;
    try {
      const res = await api.get(`/messages/${threadId}`);
      setMessages(res.data);
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!threadId) return;
    fetchMessages();
    // Poll every 3 seconds so both sides see new messages
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [threadId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      await api.post("/messages", { threadId, content });
      setContent("");
      await fetchMessages();
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!threadId) {
    return <p>Select a conversation to start chatting</p>;
  }

  return (
    <div style={styles.container}>
      <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>Chat</h3>

      <div style={styles.messages}>
        {loading ? (
          <p style={{ color: "#888", fontSize: "0.85rem" }}>Loading...</p>
        ) : messages.length === 0 ? (
          <p style={{ color: "#888", fontSize: "0.85rem" }}>No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.message,
                alignSelf: msg.sender_id === userId ? "flex-end" : "flex-start",
                backgroundColor: msg.sender_id === userId ? "#DCF8C6" : "#EEE",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.9rem" }}>{msg.content}</p>
              <small style={{ color: "#888", fontSize: "0.7rem" }}>
                {new Date(msg.created_at).toLocaleTimeString()}
              </small>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputContainer}>
        <input
          type="text"
          placeholder="Type a message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          style={styles.input}
        />
        <button onClick={sendMessage} disabled={sending} style={styles.button}>
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
  },
  messages: {
    height: "250px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "10px",
    padding: "4px",
  },
  message: {
    padding: "8px 12px",
    borderRadius: "10px",
    maxWidth: "75%",
  },
  inputContainer: {
    display: "flex",
    gap: "6px",
  },
  input: {
    flex: 1,
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "0.9rem",
  },
  button: {
    padding: "8px 14px",
    cursor: "pointer",
    borderRadius: "6px",
    border: "none",
    background: "#7C3AED",
    color: "white",
    fontWeight: "bold",
  },
};
