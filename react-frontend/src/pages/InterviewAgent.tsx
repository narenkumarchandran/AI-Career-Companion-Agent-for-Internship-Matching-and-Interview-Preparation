import { useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import remarkGfm from "remark-gfm";
import {
  Brain,
  Send,
  Bot,
  User,
  FileText,
  Upload,
  FileUp,
  Sparkles,
  Target,
  BookOpen,
  Map,
  ChevronDown,
  RefreshCw,
  Trash2,
  MessageSquare,
  X,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { resumeApi } from "../api/resume";
import { interviewAgentApi, documentQAApi } from "../api/chatbot";
import type { ResumeOut } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "interview" | "document";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Quick-action chip definitions
// ---------------------------------------------------------------------------

const INTERVIEW_CHIPS = [
  { label: "Recommend roles for me", icon: Target },
  { label: "Generate 10 technical interview questions", icon: Brain },
  { label: "Generate HR & behavioral questions", icon: MessageSquare },
  { label: "Create a 2-week interview roadmap", icon: Map },
  { label: "What topics should I prepare?", icon: BookOpen },
  { label: "Identify my skill gaps", icon: Lightbulb },
];

const DOC_CHIPS = [
  { label: "Summarize this document", icon: FileText },
  { label: "Generate 10 questions from this document", icon: Brain },
  { label: "What are the key topics covered?", icon: BookOpen },
  { label: "List the main points", icon: Target },
];

// ---------------------------------------------------------------------------
// Helper: Typing indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex gap-3 items-start"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/20">
        <Bot className="w-4 h-4" />
      </div>
      <div className="px-4 py-3.5 rounded-2xl rounded-tl-sm agent-bubble-bot flex gap-1.5 items-center">
        {[0, 0.18, 0.36].map((d, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 0.65, delay: d }}
            className="w-2 h-2 bg-muted-foreground/70 rounded-full"
          />
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function InterviewAgent() {
  // ---- State ---------------------------------------------------------------
  const [mode, setMode] = useState<Mode>("interview");
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [selectedResume, setSelectedResume] = useState<ResumeOut | null>(null);
  const [resumeDropdownOpen, setResumeDropdownOpen] = useState(false);

  // Interview Agent state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "👋 Hi! I'm **InterviewGPT**, your personal AI Interview Coach.\n\n" +
        "**Here's what I can help you with:**\n" +
        "- 🎯 Recommend roles that match your skills\n" +
        "- ❓ Generate role-specific interview questions (technical & HR)\n" +
        "- 📝 Provide model answers and tips\n" +
        "- 🗺️ Create a personalized interview preparation roadmap\n" +
        "- 📚 Suggest a learning path for your target role\n\n" +
        "**To get started:** Select your resume from the panel on the left, then ask me anything!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Document Q&A state
  const [docSessionId, setDocSessionId] = useState<string | null>(null);
  const [docFilename, setDocFilename] = useState<string | null>(null);
  const [docMessages, setDocMessages] = useState<Message[]>([
    {
      id: "doc-welcome",
      role: "bot",
      content:
        "📄 **Document Q&A Mode**\n\n" +
        "Upload a **PDF or DOCX** file using the panel on the left, and I'll:\n" +
        "- Answer your questions about the document\n" +
        "- Generate questions and answers from the content\n" +
        "- Summarize key topics and main points\n\n" +
        "Upload a document to get started!",
      timestamp: new Date(),
    },
  ]);
  const [docInput, setDocInput] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- Effects -------------------------------------------------------------
  useEffect(() => {
    loadResumes();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, docMessages, loading, docLoading]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // ---- Loaders -------------------------------------------------------------
  const loadResumes = async () => {
    try {
      const { data } = await resumeApi.list();
      setResumes(data);
      // Auto-select the most recent parsed resume
      const parsed = data.filter((r) => r.parsed_status === "parsed");
      if (parsed.length > 0) setSelectedResume(parsed[0]);
    } catch {
      toast.error("Failed to load resumes");
    }
  };

  // ---- Interview Agent logic ------------------------------------------------
  const sendInterviewMessage = async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || loading) return;

    const hasToken = !!localStorage.getItem("access_token");
    if (!hasToken) {
      toast.error("Please log in to use the Interview Agent.");
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msgText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Create session on first message
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const { data: session } = await interviewAgentApi.createSession();
        currentSessionId = session.id;
        setSessionId(currentSessionId);
      }

      // Send message with optional resume context
      const { data: reply } = await interviewAgentApi.sendMessage(
        currentSessionId,
        msgText,
        selectedResume?.id
      );

      setMessages((prev) => [
        ...prev,
        {
          id: reply.id,
          role: "bot",
          content: reply.message,
          timestamp: new Date(reply.created_at),
        },
      ]);
    } catch (err) {
      console.error("Agent error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "bot",
          content:
            "⚠️ Something went wrong. Please check the server is running and try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearInterviewChat = () => {
    setSessionId(null);
    setMessages([
      {
        id: "welcome-new",
        role: "bot",
        content:
          "🔄 Chat cleared! I'm ready to help you prepare for your interviews.\n\n" +
          "Select your resume on the left and ask me anything!",
        timestamp: new Date(),
      },
    ]);
  };

  // ---- Document Q&A logic --------------------------------------------------
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDocDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: docUploading,
  });

  async function handleDocDrop(files: File[]) {
    if (!files[0]) return;
    const hasToken = !!localStorage.getItem("access_token");
    if (!hasToken) {
      toast.error("Please log in to upload documents.");
      return;
    }

    setDocUploading(true);
    const toastId = toast.loading(`Uploading & indexing "${files[0].name}"...`);

    try {
      const { data } = await documentQAApi.uploadDocument(files[0]);
      setDocSessionId(data.doc_session_id);
      setDocFilename(data.filename);
      toast.success(
        `"${data.filename}" indexed into ${data.chunk_count} chunks!`,
        { id: toastId }
      );

      setDocMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "bot",
          content:
            `✅ **"${data.filename}"** has been uploaded and indexed into **${data.chunk_count} chunks**.\n\n` +
            "You can now ask me questions about this document. Try one of the quick actions below!",
          timestamp: new Date(),
        },
      ]);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(detail ?? "Upload failed", { id: toastId });
    } finally {
      setDocUploading(false);
    }
  }

  const sendDocMessage = async (text?: string) => {
    const msgText = (text ?? docInput).trim();
    if (!msgText || docLoading) return;

    if (!docSessionId) {
      toast.error("Please upload a document first.");
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msgText,
      timestamp: new Date(),
    };
    setDocMessages((prev) => [...prev, userMsg]);
    setDocInput("");
    setDocLoading(true);

    try {
      const { data } = await documentQAApi.sendMessage(docSessionId, msgText);
      setDocMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_bot",
          role: "bot",
          content: data.answer,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setDocMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "bot",
          content: "⚠️ Failed to get an answer. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setDocLoading(false);
    }
  };

  const clearDocChat = () => {
    setDocSessionId(null);
    setDocFilename(null);
    setDocMessages([
      {
        id: "doc-welcome-new",
        role: "bot",
        content:
          "📄 Document cleared! Upload a new PDF or DOCX to start a fresh Q&A session.",
        timestamp: new Date(),
      },
    ]);
  };

  // ---- Render helpers -------------------------------------------------------
  const currentMessages = mode === "interview" ? messages : docMessages;
  const currentLoading = mode === "interview" ? loading : docLoading;
  const chips = mode === "interview" ? INTERVIEW_CHIPS : DOC_CHIPS;

  const handleChipClick = (label: string) => {
    if (mode === "interview") sendInterviewMessage(label);
    else sendDocMessage(label);
  };

  const handleSend = () => {
    if (mode === "interview") sendInterviewMessage();
    else sendDocMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentInput = mode === "interview" ? input : docInput;
  const setCurrentInput = mode === "interview" ? setInput : setDocInput;

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full flex bg-background overflow-hidden agent-page">
      {/* ===== LEFT PANEL ===== */}
      <aside className="w-72 shrink-0 border-r border-border flex flex-col bg-card/40 backdrop-blur-md overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Interview Agent</h1>
              <p className="text-[11px] text-muted-foreground">Powered by Groq</p>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="p-4 border-b border-border space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Mode
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setMode("interview")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left border ${
                mode === "interview"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Brain className="w-4 h-4 shrink-0" />
              Interview Prep
              {mode === "interview" && (
                <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-primary" />
              )}
            </button>
            <button
              onClick={() => setMode("document")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left border ${
                mode === "document"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              Document Q&A
              {mode === "document" && (
                <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Interview Mode: Resume Picker */}
        {mode === "interview" && (
          <div className="p-4 border-b border-border space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Resume Context
            </p>

            {resumes.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-3 px-2 bg-secondary/30 rounded-xl border border-dashed border-border">
                No resumes found. Upload a resume in My Resumes first.
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setResumeDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-background hover:border-primary/40 transition-colors text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate text-left">
                      {selectedResume
                        ? selectedResume.original_filename
                        : "Select a resume…"}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
                      resumeDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {resumeDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                    >
                      {resumes.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setSelectedResume(r);
                            setResumeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-secondary/60 transition-colors ${
                            selectedResume?.id === r.id
                              ? "bg-primary/10 text-primary"
                              : ""
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{r.original_filename}</span>
                          {r.parsed_status === "parsed" && (
                            <Badge variant="outline" className="ml-auto text-[9px] shrink-0 px-1 py-0">
                              parsed
                            </Badge>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {selectedResume && (
              <div className="bg-secondary/40 rounded-xl p-3 text-xs space-y-1.5 border border-border">
                {selectedResume.full_name && (
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <User className="w-3.5 h-3.5 text-primary" />
                    {selectedResume.full_name}
                  </div>
                )}
                {Array.isArray(selectedResume.skills) &&
                  (selectedResume.skills as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(selectedResume.skills as string[]).slice(0, 5).map((s) => (
                        <span
                          key={s}
                          className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                      {(selectedResume.skills as string[]).length > 5 && (
                        <span className="text-muted-foreground text-[10px]">
                          +{(selectedResume.skills as string[]).length - 5} more
                        </span>
                      )}
                    </div>
                  )}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-2 text-xs h-8"
              onClick={loadResumes}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Resumes
            </Button>
          </div>
        )}

        {/* Document Mode: Upload Panel */}
        {mode === "document" && (
          <div className="p-4 border-b border-border space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Upload Document
            </p>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/20"
              } ${docUploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <input {...getInputProps()} />
              {docUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground">Processing…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
                    <FileUp className={`w-4 h-4 ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {isDragActive ? "Drop it!" : "PDF or DOCX"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Max 10 MB · Click or drag</p>
                </div>
              )}
            </div>

            {docFilename && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 truncate">
                  {docFilename}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="p-4 flex-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Quick Actions
          </p>
          <div className="flex flex-col gap-1.5">
            {chips.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => handleChipClick(label)}
                disabled={
                  currentLoading ||
                  (mode === "document" && !docSessionId)
                }
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all border border-transparent hover:border-border disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear button */}
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-xs h-8 text-muted-foreground hover:text-destructive"
            onClick={mode === "interview" ? clearInterviewChat : clearDocChat}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat
          </Button>
        </div>
      </aside>

      {/* ===== MAIN CHAT AREA ===== */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/30 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              {mode === "interview" ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-sm leading-none">
                {mode === "interview" ? "InterviewGPT" : "Document Q&A"}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {mode === "interview"
                  ? selectedResume
                    ? `Context: ${selectedResume.original_filename}`
                    : "No resume selected — responses will be general"
                  : docFilename
                  ? `Document: ${docFilename}`
                  : "No document uploaded yet"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {currentMessages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-3 items-start ${
                  m.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    m.role === "user"
                      ? "bg-secondary border-border text-muted-foreground"
                      : "bg-primary/15 border-primary/20 text-primary"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[75%] shadow-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border rounded-tl-sm"
                  }`}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="agent-markdown">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-base font-bold mt-3 mb-2 first:mt-0">{children}</h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-sm font-bold mt-3 mb-2 first:mt-0 text-primary">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>
                          ),
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0">{children}</p>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-4 my-1.5 space-y-1">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-4 my-1.5 space-y-1">{children}</ol>
                          ),
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          code: ({ children }) => (
                            <code className="bg-secondary/80 rounded px-1.5 py-0.5 font-mono text-xs border border-border">
                              {children}
                            </code>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-primary pl-3 my-2 text-muted-foreground italic">
                              {children}
                            </blockquote>
                          ),
                          hr: () => <hr className="border-border my-3" />,
                          // ---- Table rendering ----
                          table: ({ children }) => (
                            <div className="agent-table-wrapper">
                              <table className="agent-table">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="agent-thead">{children}</thead>
                          ),
                          tbody: ({ children }) => (
                            <tbody className="agent-tbody">{children}</tbody>
                          ),
                          tr: ({ children }) => (
                            <tr className="agent-tr">{children}</tr>
                          ),
                          th: ({ children }) => (
                            <th className="agent-th">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="agent-td">{children}</td>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {currentLoading && <TypingIndicator />}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-card/30 backdrop-blur-md shrink-0">
          {/* Chips for desktop — shown above input on narrow screens */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {chips.slice(0, 3).map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => handleChipClick(label)}
                disabled={
                  currentLoading ||
                  (mode === "document" && !docSessionId)
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-xs text-muted-foreground hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon className="w-3 h-3 text-primary" />
                {label}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <div className="flex gap-2 items-end">
            <textarea
              rows={1}
              className="flex-1 px-4 py-3 bg-secondary/50 border border-border hover:border-border/80 focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl text-sm outline-none transition-all placeholder:text-muted-foreground resize-none min-h-[46px] max-h-[140px]"
              placeholder={
                mode === "interview"
                  ? selectedResume
                    ? `Ask InterviewGPT about ${selectedResume.original_filename}…`
                    : "Ask about roles, interview questions, or career roadmaps…"
                  : docSessionId
                  ? `Ask a question about "${docFilename}"…`
                  : "Upload a document first, then ask questions about it…"
              }
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 140) + "px";
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!currentInput.trim() || currentLoading}
              size="icon"
              className="h-[46px] w-[46px] rounded-2xl shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </main>
    </div>
  );
}
