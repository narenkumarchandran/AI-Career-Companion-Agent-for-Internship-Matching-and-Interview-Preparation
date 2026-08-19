import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Minimize2, Maximize2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "bot", content: "Hi! I'm your AI career assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, minimized]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_CHATBOT_API_URL;
      let botResponseText = "";

      if (!apiUrl) {
        await new Promise(r => setTimeout(r, 1500));
        botResponseText = "API is not configured yet. Please add VITE_CHATBOT_API_URL to your frontend .env file to enable AI responses!";
      } else {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMsg.content, history: messages }),
        });
        
        if (!res.ok) throw new Error("API response error");
        const data = await res.json();
        botResponseText = data.reply || data.response || data.answer || "I received a response, but couldn't parse it.";
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: botResponseText }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setOpen(true); setMinimized(false); }}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 border border-primary/50"
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: minimized ? 64 : 520
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div 
              className="p-4 bg-secondary/30 border-b border-border flex items-center justify-between cursor-pointer group"
              onClick={() => setMinimized(m => !m)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm leading-none text-foreground">InternAI Assistant</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Online</div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <button 
                  className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors"
                  onClick={(e) => { e.stopPropagation(); setMinimized(m => !m); }}
                >
                  {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button 
                  className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md text-muted-foreground transition-colors"
                  onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            {!minimized && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scroll-smooth">
                  {messages.map(m => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={m.id} 
                      className={`flex gap-3 items-start ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                        {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[80%] ${
                        m.role === "user" 
                          ? "bg-primary text-primary-foreground rounded-tr-sm" 
                          : "bg-secondary text-foreground rounded-tl-sm"
                      }`}>
                        {m.content}
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex gap-3 items-start"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="px-4 py-3.5 rounded-2xl rounded-tl-sm bg-secondary flex gap-1.5 items-center">
                        <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                        <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                        <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Input Box */}
                <div className="p-3 border-t border-border bg-background">
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      className="w-full pl-4 pr-12 py-3 bg-secondary/50 border border-border hover:border-border/80 focus:border-primary focus:ring-1 focus:ring-primary rounded-full text-sm outline-none transition-all placeholder:text-muted-foreground"
                      placeholder="Ask me anything..."
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
                    />
                    <button 
                      onClick={sendMessage}
                      disabled={!input.trim() || loading}
                      className={`absolute right-1.5 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        input.trim() && !loading 
                          ? "bg-primary text-primary-foreground hover:scale-105" 
                          : "bg-transparent text-muted-foreground"
                      }`}
                    >
                      <Send className={`w-4 h-4 ${input.trim() && !loading ? "ml-[-2px]" : ""}`} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
