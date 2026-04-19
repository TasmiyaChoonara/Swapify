import { useEffect, useState } from "react";

export default function Chat({ threadId, userId }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  // 🔄 Load messages when thread changes
  useEffect(() => {
    if (!threadId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/messages/${threadId}`);
        const data = await res.json();
        setMessages(data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading messages:", err);
      }
    };

    fetchMessages();
  }, [threadId]);

  // 📤 Send message
  const sendMessage = async () => {
    if (!content.trim()) return;

    try {
      await fetch("http://localhost:3000/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          senderId: userId,
          content,
        }),
      });

      // 🔄 Reload messages after sending
      const res = await fetch(`http://localhost:3000/api/messages/${threadId}`);
      const data = await res.json();
      setMessages(data);

      setContent("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  if (!threadId) {
    return <p>Select a conversation to start chatting</p>;
  }

  return (
    <div style={styles.container}>
      <h3>Chat</h3>

      {/* Messages */}
      <div style={styles.messages}>
        {loading ? (
          <p>Loading...</p>
        ) : messages.length === 0 ? (
          <p>No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.message,
                alignSelf: msg.sender_id === userId ? "flex-end" : "flex-start",
                backgroundColor:
                  msg.sender_id === userId ? "#DCF8C6" : "#EEE",
              }}
            >
              <p>{msg.content}</p>
              <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div style={styles.inputContainer}>
        <input
          type="text"
          placeholder="Type a message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.button}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    border: "1px solid #ccc",
    padding: "10px",
    width: "300px",
    display: "flex",
    flexDirection: "column",
  },
  messages: {
    height: "250px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    marginBottom: "10px",
  },
  message: {
    padding: "8px",
    borderRadius: "10px",
    maxWidth: "70%",
  },
  inputContainer: {
    display: "flex",
    gap: "5px",
  },
  input: {
    flex: 1,
    padding: "5px",
  },
  button: {
    padding: "5px 10px",
    cursor: "pointer",
  },
};