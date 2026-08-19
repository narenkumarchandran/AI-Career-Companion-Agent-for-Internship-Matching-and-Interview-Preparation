import { useEffect, useState, useCallback } from "react";
import { resumeApi } from "../api/resume";
import type { ResumeOut } from "../types";
import toast from "react-hot-toast";

/**
 * Shared hook: loads resumes once, exposes list + a helper to pick
 * the "best default" (most-recent successfully parsed resume).
 */
export function useResumes() {
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await resumeApi.list();
      setResumes(data);
    } catch {
      toast.error("Failed to load resumes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /** Latest resume that was successfully parsed — good default selection */
  const defaultResume: ResumeOut | null =
    resumes
      .filter(r => r.parsed_status === "parsed")
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0]
    ?? resumes.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0]
    ?? null;

  const parsedResumes = resumes.filter(r => r.parsed_status === "parsed");

  return { resumes, parsedResumes, defaultResume, loading, refresh };
}
