// ---------------------------------------------------------------------------
// Shared TypeScript types mirroring the FastAPI Pydantic schemas
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ResumeOut {
  id: string;
  user_id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
  parsed_status: string;
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedin_url?: string;
  github_url?: string;
  professional_summary?: string;
  skills?: unknown;
  technical_skills?: unknown;
  soft_skills?: unknown;
  education?: unknown;
  work_experience?: unknown;
  projects?: unknown;
  certifications?: unknown;
  internships?: unknown;
  languages?: unknown;
  achievements?: unknown;
  other_info?: unknown;
}

export interface InternshipPosting {
  id: string;
  company: string;
  role_title: string;
  domain: string;
  location: string;
  mode: string;
  duration_weeks: number;
  stipend_inr_per_month: number;
  min_education: string;
  required_skills: string[];
  preferred_skills: string[];
  description: string;
}

export interface InternshipMatch extends InternshipPosting {
  match_score: number;
  match_percentage: number;
  match_label: string;
  semantic_score: number;
  skill_score: number;
  education_score: number;
  location_score: number;
  matched_skills: string[];
  missing_skills: string[];
}

export interface InternshipMatchResponse {
  resume_id: string;
  query_skills: string | null;
  results: InternshipMatch[];
  summary: string | null;
}
