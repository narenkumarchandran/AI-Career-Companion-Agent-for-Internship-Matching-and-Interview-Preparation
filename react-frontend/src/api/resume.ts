import { apiClient } from "./client";
import type { ResumeOut } from "../types";

export const resumeApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<ResumeOut>("/resume/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  list: () => apiClient.get<ResumeOut[]>("/resume/"),

  download: (id: string) =>
    apiClient.get(`/resume/${id}/download`, { responseType: "blob" }),

  delete: (id: string) => apiClient.delete(`/resume/${id}`),
};
