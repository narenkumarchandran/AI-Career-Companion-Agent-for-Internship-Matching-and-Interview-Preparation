# ---------------------------------------------------------------------------
# HYBRID RESUME PARSER — regex for deterministic fields, an LLM (via Groq)
# for everything contextual/free-form.
# ---------------------------------------------------------------------------
# Why hybrid, not all-LLM or all-regex?
#   - Email/phone/LinkedIn/GitHub have a fixed *shape* regardless of resume
#     layout -> regex is faster and never hallucinates for these.
#   - Skills/education/work experience/etc. have NO fixed shape across
#     resumes -> regex breaks constantly here, so an LLM that understands
#     context does the job instead.
# See app/routers/resume.py for where parse_resume() is called (right after
# the uploaded file is saved to disk, before the DB row is created).
# ---------------------------------------------------------------------------

import re
import json

import fitz  # PyMuPDF
from docx import Document
from groq import Groq

from app.config import settings

client = Groq(api_key=settings.groq_api_key)


def extract_text(file_path: str) -> str:
    """Extract raw text from a resume file. Supports .pdf, .doc, and .docx."""
    ext = file_path.lower().rsplit(".", 1)[-1]

    if ext == "pdf":
        text = ""
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text()
        return text

    elif ext in ("doc", "docx"):
        doc = Document(file_path)
        return "\n".join(para.text for para in doc.paragraphs)

    else:
        raise ValueError(f"Unsupported file type: .{ext}")


def regex_extract(text: str) -> dict:
    """Extract deterministic fields — these have a fixed pattern regardless
    of how the rest of the resume is laid out, so regex is the right tool."""
    data = {}

    email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
    data["email"] = email_match.group() if email_match else None

    phone_match = re.search(
        r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4,6}", text
    )
    data["phone"] = phone_match.group().strip() if phone_match else None

    linkedin_match = re.search(r"(https?://)?(www\.)?linkedin\.com/in/[A-Za-z0-9\-_/]+", text)
    data["linkedin"] = linkedin_match.group() if linkedin_match else None

    github_match = re.search(r"(https?://)?(www\.)?github\.com/[A-Za-z0-9\-_/]+", text)
    data["github"] = github_match.group() if github_match else None

    # Name heuristic: first non-empty line that isn't itself an email/URL/
    # phone number. Not bulletproof — the LLM's full_name below acts as a
    # fallback if this heuristic guesses wrong or comes up empty.
    name = None
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if "@" in line or "linkedin" in line.lower() or "github" in line.lower():
            continue
        if re.search(r"\d{5,}", line):
            continue
        name = line
        break
    data["name"] = name

    return data


LLM_FIELDS = """
- full_name
- address
- professional_summary
- skills
- technical_skills
- soft_skills
- education
- work_experience
- projects
- certifications
- internships
- languages
- achievements
- other_info   (anything relevant that doesn't fit the fields above)
"""


def llm_extract(text: str, model: str = "llama-3.3-70b-versatile") -> dict:
    """Everything that needs *understanding*, not pattern matching, goes
    through the LLM. temperature=0 keeps it as deterministic as an LLM
    call can be, and the prompt explicitly forbids inventing data."""
    prompt = f"""
You are an expert resume parser.

Extract the following fields from the resume text below.
If a field is not present, set it to null (single values) or an empty
list (list-type fields like skills, education, work_experience, etc.).
Do not invent information that is not present in the resume.

Return ONLY valid JSON. No markdown fences, no commentary.

Fields to extract:
{LLM_FIELDS}

Resume:
{text}
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert resume parser. You always return valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
    )

    raw_output = response.choices[0].message.content
    # Models sometimes wrap JSON in ```json fences even when told not to —
    # strip those defensively before parsing rather than trusting the model.
    cleaned = raw_output.strip()
    cleaned = re.sub(r"^```json\s*|^```\s*|```$", "", cleaned, flags=re.MULTILINE).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Surface the problem instead of silently failing, so a bad prompt/
        # model response is debuggable rather than producing a blank profile.
        return {"error": "Could not parse LLM response as JSON", "raw_response": raw_output}


def merge_results(regex_data: dict, llm_data: dict) -> dict:
    """Regex wins for deterministic fields (name/email/phone/links) since
    it can't hallucinate; everything else comes from the LLM pass."""
    return {
        "full_name": regex_data.get("name") or llm_data.get("full_name"),
        "email": regex_data.get("email"),
        "phone": regex_data.get("phone"),
        "address": llm_data.get("address"),
        "linkedin_url": regex_data.get("linkedin"),
        "github_url": regex_data.get("github"),
        "professional_summary": llm_data.get("professional_summary"),
        "skills": llm_data.get("skills"),
        "technical_skills": llm_data.get("technical_skills"),
        "soft_skills": llm_data.get("soft_skills"),
        "education": llm_data.get("education"),
        "work_experience": llm_data.get("work_experience"),
        "projects": llm_data.get("projects"),
        "certifications": llm_data.get("certifications"),
        "internships": llm_data.get("internships"),
        "languages": llm_data.get("languages"),
        "achievements": llm_data.get("achievements"),
        "other_info": llm_data.get("other_info"),
    }


def parse_resume(file_path: str) -> dict:
    """End-to-end: extract text -> regex pass -> LLM pass -> merge.
    Called once per upload from app/routers/resume.py, after the file
    has already been saved to disk."""
    text = extract_text(file_path)
    regex_data = regex_extract(text)
    llm_data = llm_extract(text)
    return merge_results(regex_data, llm_data)
