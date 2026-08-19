import { apiClient } from "./client";
import type { InternshipPosting, InternshipMatchResponse } from "../types";

export const internshipApi = {
  list: () => apiClient.get<InternshipPosting[]>("/internships/"),

  match: (resumeId: string, k = 10) =>
    apiClient.get<InternshipMatchResponse>(`/internships/match/${resumeId}?k=${k}`),
};
