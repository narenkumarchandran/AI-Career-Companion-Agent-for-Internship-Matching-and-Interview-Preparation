// ---------------------------------------------------------------------------
// Applied jobs — persisted to localStorage
// ---------------------------------------------------------------------------
const APPLIED_KEY = "aicareer_applied_jobs";

export function getAppliedJobs(): string[] {
  try { return JSON.parse(localStorage.getItem(APPLIED_KEY) ?? "[]"); }
  catch { return []; }
}

export function applyToJob(jobId: string): void {
  const existing = getAppliedJobs();
  if (!existing.includes(jobId)) {
    localStorage.setItem(APPLIED_KEY, JSON.stringify([...existing, jobId]));
  }
}

export function isApplied(jobId: string): boolean {
  return getAppliedJobs().includes(jobId);
}

// ---------------------------------------------------------------------------
// Cover letter generator — uses localStorage profile
// ---------------------------------------------------------------------------
interface ProfileData {
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedin_url?: string;
  github_url?: string;
  professional_summary?: string;
  skills?: string[];
  technical_skills?: string[];
  education?: { degree?: string; institution?: string; year?: string }[];
  work_experience?: { company?: string; role?: string; duration?: string; description?: string }[];
  projects?: { name?: string; description?: string }[];
  certifications?: string[];
}

function loadProfile(): ProfileData {
  try { return JSON.parse(localStorage.getItem("aicareer_profile") ?? "{}"); }
  catch { return {}; }
}

export function generateCoverLetter(job: {
  role_title: string;
  company: string;
  domain: string;
  required_skills?: string[];
  description?: string;
}): string {
  const p = loadProfile();
  const today = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  const name = p.full_name || "[Your Name]";
  const email = p.email || "[Email]";
  const phone = p.phone || "[Phone]";
  const location = p.address || "[Location]";

  // Pick the most relevant skills
  const allSkills = [...(p.skills ?? []), ...(p.technical_skills ?? [])];
  const matched = job.required_skills?.filter(s => allSkills.some(ps => ps.toLowerCase().includes(s.toLowerCase()))) ?? [];
  const skillLine = matched.length > 0
    ? matched.slice(0, 5).join(", ")
    : allSkills.slice(0, 5).join(", ") || "relevant technical skills";

  // Latest education
  const edu = p.education?.[0];
  const eduLine = edu
    ? `${edu.degree || "my degree"} from ${edu.institution || "my institution"}${edu.year ? ` (${edu.year})` : ""}`
    : "my academic background";

  // Latest work / project
  const work = p.work_experience?.[0];
  const workLine = work?.company
    ? `${work.role || "intern"} at ${work.company}${work.duration ? ` (${work.duration})` : ""}`
    : null;
  const proj = p.projects?.[0];
  const projLine = proj?.name ? proj.name : null;

  const experiencePara = workLine
    ? `Most recently, I worked as ${workLine}, where I ${work?.description?.slice(0, 150) || "delivered impactful technical work"}.`
    : projLine
    ? `I have built hands-on projects including "${projLine}", which demonstrates my ability to deliver end-to-end technical solutions.`
    : "I have developed strong hands-on skills through academic projects and self-driven development.";

  const summary = p.professional_summary
    ? p.professional_summary.slice(0, 200)
    : `a passionate and driven ${job.domain} enthusiast with a strong foundation in software development`;

  const certs = (p.certifications ?? []).slice(0, 2).join(" and ");
  const certLine = certs ? `I hold certifications in ${certs}. ` : "";

  return `${today}

Hiring Manager
${job.company}

Dear Hiring Manager,

I am writing to express my enthusiastic interest in the ${job.role_title} position at ${job.company}. With ${eduLine} and demonstrated expertise in ${skillLine}, I am confident that I can make a meaningful contribution to your team.

${summary}.

${experiencePara} ${certLine}My technical proficiency spans ${skillLine}, which aligns directly with the requirements of this role.

${job.description ? `The opportunity excites me particularly because: "${job.description.slice(0, 180)}…" This resonates with my career goals and the kind of impact I want to create.` : `I am drawn to ${job.company}'s work in the ${job.domain} space and believe this internship will be a transformative experience.`}

I am available for a ${job.role_title.toLowerCase()} internship and am eager to bring my skills, dedication, and fresh perspective to ${job.company}. I would welcome the opportunity to discuss how I can contribute to your team.

Thank you for your time and consideration.

Warm regards,
${name}
${email} | ${phone}${location ? ` | ${location}` : ""}${p.linkedin_url ? `\n${p.linkedin_url}` : ""}${p.github_url ? `\n${p.github_url}` : ""}
`;
}
