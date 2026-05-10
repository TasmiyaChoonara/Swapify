import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import api from "../services/api";

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : 'http://localhost:3000';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style={{ display: 'block' }}>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 14px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--text-muted)',
          animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          display: 'inline-block',
        }} />
      ))}
    </div>
  );
}

export default function Chat({ threadId, userId }) {
  const [messages, setMessages]         = useState([]);
  const [content, setContent]           = useState("");
  const [loading, setLoading]           = useState(true);
  const [isOtherTyping, setOtherTyping] = useState(false);
  const bottomRef       = useRef(null);
  const socketRef       = useRef(null);
  const typingTimer     = useRef(null);
  const stopTypingTimer = useRef(null);

  // Initial load via HTTP
  useEffect(() => {
    if (!threadId) return;
    api.get(`/messages/${threadId}`)
      .then(res => setMessages(res.data))
      .catch(err => console.error("Error loading messages:", err))
      .finally(() => setLoading(false));
  }, [threadId]);

  // Socket.io connection
  useEffect(() => {
    if (!threadId) return;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    // Pass userId at join time — server stores it and ignores senderId on send_message
    socket.emit('join_thread', { threadId, userId });

    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('user_typing', () => {
      setOtherTyping(true);
      clearTimeout(stopTypingTimer.current);
      stopTypingTimer.current = setTimeout(() => setOtherTyping(false), 3000);
    });

    socket.on('user_stopped_typing', () => {
      setOtherTyping(false);
      clearTimeout(stopTypingTimer.current);
    });

    return () => {
      socket.disconnect();
      clearTimeout(typingTimer.current);
      clearTimeout(stopTypingTimer.current);
    };
  }, [threadId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOtherTyping]);

  function handleInputChange(e) {
    setContent(e.target.value);
    if (!socketRef.current) return;
    socketRef.current.emit('typing_start', { threadId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', { threadId });
    }, 1500);
  }

  function sendMessage() {
    if (!content.trim()) return;
    clearTimeout(typingTimer.current);
    socketRef.current?.emit('typing_stop', { threadId });
    // senderId is NOT passed — server uses socket.data.userId set at join time
    socketRef.current?.emit('send_message', { threadId, content });
    setContent("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!threadId) {
    return <p style={{ color: 'var(--text-muted)' }}>Select a conversation to start chatting</p>;
  }

  // Build a flat list interleaving date separators and message nodes
  const items = [];
  messages.forEach((msg, idx) => {
    const msgDate = msg.sent_at ? new Date(msg.sent_at).toDateString() : '';
    const prevDate = idx > 0 && messages[idx - 1].sent_at
      ? new Date(messages[idx - 1].sent_at).toDateString()
      : null;
    if (msgDate !== prevDate) {
      items.push({ type: 'separator', key: `sep-${idx}`, date: msg.sent_at });
    }
    items.push({ type: 'message', key: msg.id ?? `msg-${idx}`, msg });
  });

  return (
    <>
      {/* Keyframe injection for typing animation */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            width="16" height="16" style={{ color: 'var(--accent)', flexShrink: 0 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>Chat</span>
        </div>

        {/* Message list */}
        <div style={styles.messages}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
              No messages yet. Say hello!
            </div>
          ) : (
            items.map(item => {
              if (item.type === 'separator') {
                return (
                  <div key={item.key} style={styles.dateSep}>
                    <span style={styles.dateSepLabel}>{formatDateLabel(item.date)}</span>
                  </div>
                );
              }
              const { msg } = item;
              const isOwn = msg.sender_id === userId;
              const senderLabel = isOwn ? 'You' : (msg.sender_name ?? 'Unknown');
              return (
                <div key={item.key} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', paddingLeft: isOwn ? 0 : '4px', paddingRight: isOwn ? '4px' : 0 }}>
                    {senderLabel}
                  </span>
                  <div style={{
                    ...styles.bubble,
                    background: isOwn ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                    color: isOwn ? '#fff' : 'var(--text)',
                    borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.45 }}>{msg.content}</p>
                    <small style={{
                      display: 'block',
                      textAlign: 'right',
                      color: isOwn ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                      fontSize: '0.65rem',
                      marginTop: '4px',
                    }}>
                      {msg.sent_at ? formatTime(msg.sent_at) : ''}
                    </small>
                  </div>
                </div>
              );
            })
          )}

          {isOtherTyping && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', paddingLeft: '4px' }}>
                Typing
              </span>
              <div style={{
                ...styles.bubble,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '16px 16px 16px 4px',
                padding: 0,
              }}>
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={styles.inputArea}>
          <input
            type="text"
            placeholder="Message…"
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={styles.input}
          />
          <button
            onClick={sendMessage}
            disabled={!content.trim()}
            style={{
              ...styles.sendBtn,
              opacity: content.trim() ? 1 : 0.4,
              cursor: content.trim() ? 'pointer' : 'default',
            }}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    background: 'var(--surface)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  messages: {
    height: '420px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px',
  },
  dateSep: {
    display: 'flex',
    justifyContent: 'center',
    margin: '4px 0',
  },
  dateSepLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '3px 10px',
    letterSpacing: '0.03em',
  },
  bubble: {
    padding: '10px 14px',
    maxWidth: '78%',
    wordBreak: 'break-word',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    outline: 'none',
    lineHeight: 1.4,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
};
