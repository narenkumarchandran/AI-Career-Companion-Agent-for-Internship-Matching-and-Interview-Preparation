import { apiClient } from "./client";

// ---- Types ----------------------------------------------------------------

export interface ChatSession {
  id: string;
  user_id: string;
  created_at: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
}

export interface DocumentUploadResponse {
  doc_session_id: string;
  filename: string;
  chunk_count: number;
  message: string;
}

export interface DocQAMessageResponse {
  doc_session_id: string;
  question: string;
  answer: string;
}

// ---- Existing chatbot API (floating widget) --------------------------------

export const chatbotApi = {
  /** Create a new chat session for the current user */
  createSession: () =>
    apiClient.post<ChatSession>("/chat/sessions"),

  /** List all sessions for the current user */
  listSessions: () =>
    apiClient.get<ChatSession[]>("/chat/sessions"),

  /** Send a message and receive the assistant's reply */
  sendMessage: (sessionId: string, message: string) =>
    apiClient.post<ChatMessage>(`/chat/sessions/${sessionId}/message`, { message }),
};

// ---- Interview Preparation Agent API --------------------------------------

export const interviewAgentApi = {
  /** Create a new interview agent session */
  createSession: () =>
    apiClient.post<ChatSession>("/chat/agent/sessions"),

  /** List all agent sessions for the current user */
  listSessions: () =>
    apiClient.get<ChatSession[]>("/chat/agent/sessions"),

  /**
   * Send a message to the interview agent.
   * Optionally include a resume_id for personalized responses.
   */
  sendMessage: (sessionId: string, message: string, resumeId?: string) =>
    apiClient.post<ChatMessage>(`/chat/agent/sessions/${sessionId}/message`, {
      message,
      resume_id: resumeId ?? null,
    }),
};

// ---- Document Q&A API -----------------------------------------------------

export const documentQAApi = {
  /**
   * Upload a PDF or DOCX document.
   * Returns a doc_session_id to use in subsequent message calls.
   */
  uploadDocument: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<DocumentUploadResponse>("/chat/document/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /** Ask a question about a previously uploaded document */
  sendMessage: (docSessionId: string, message: string) =>
    apiClient.post<DocQAMessageResponse>(`/chat/document/${docSessionId}/message`, {
      message,
    }),
};
