"""
Interview Preparation Agent Service
====================================
This service provides a resume-aware interview preparation AI agent.
It takes the candidate's parsed resume data and uses it as personalized
context for the LLM to:
  - Recommend suitable roles / internships
  - Generate targeted technical & HR interview questions
  - Create an interview preparation roadmap
  - Suggest learning paths and topics to prepare
"""

import uuid
from sqlalchemy.orm import Session
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from app.config import settings
from app.crud import get_chat_messages, get_resume_by_id

# ---------------------------------------------------------------------------
# SYSTEM PROMPT
# ---------------------------------------------------------------------------

INTERVIEW_AGENT_SYSTEM_TEMPLATE = """You are InterviewGPT, an expert AI Interview Coach and Career Advisor embedded in InternAI — an AI-powered career platform for students and early-career professionals.

Your primary role is to help the candidate prepare for job interviews and discover suitable career opportunities using their **resume data provided below**.

## Candidate Resume Context
{resume_context}

## Your Capabilities
Based on the resume context above, you can:

1. **Role Recommendation** — Recommend specific job roles, internships, and companies that align with the candidate's skills, education, and experience. Be specific and explain why each role is a good fit.

2. **Interview Question Generation** — Generate role-specific interview questions:
   - Technical questions (coding, system design, domain-specific)
   - Behavioral / HR questions (STAR format)
   - Situational and case-based questions
   - Always tailor questions to the candidate's actual skills and experience.

3. **Answer Guidance** — Provide model answers and tips for interview questions using the candidate's own projects and experiences as examples.

4. **Interview Roadmap** — Create a structured, time-bound preparation plan (e.g., 2-week or 1-month roadmap) broken into daily/weekly milestones.

5. **Learning Path** — Recommend topics to study, resources, and skills to acquire to strengthen the candidate's profile for a specific role.

6. **Resume Gap Analysis** — Identify skill gaps and suggest how to bridge them.

## Response Style
- Always be encouraging, specific, and actionable.
- Use the candidate's **actual skills, projects, and experience** from the resume context — do not give generic advice.
- Format responses with clear **Markdown headings, bullet points, and numbered lists** for readability.
- When generating interview questions, number them clearly.
- When no resume context is available, still provide helpful general guidance and ask the user to select their resume in the panel on the left.
"""


def _build_resume_context(resume) -> str:
    """Convert a Resume ORM object into a structured text context for the LLM."""
    if resume is None:
        return "No resume data available. Please select a resume from the panel on the left to get personalized guidance."

    lines = []

    if resume.full_name:
        lines.append(f"**Candidate Name:** {resume.full_name}")
    if resume.email:
        lines.append(f"**Email:** {resume.email}")
    if resume.professional_summary:
        lines.append(f"\n**Professional Summary:**\n{resume.professional_summary}")

    # Skills
    all_skills = []
    if resume.technical_skills:
        tech = resume.technical_skills if isinstance(resume.technical_skills, list) else []
        all_skills.extend(tech)
        lines.append(f"\n**Technical Skills:** {', '.join(tech)}")
    if resume.soft_skills:
        soft = resume.soft_skills if isinstance(resume.soft_skills, list) else []
        lines.append(f"**Soft Skills:** {', '.join(soft)}")
    if resume.skills and not resume.technical_skills:
        skills = resume.skills if isinstance(resume.skills, list) else []
        all_skills.extend(skills)
        lines.append(f"\n**Skills:** {', '.join(skills)}")

    # Education
    if resume.education:
        edu_list = resume.education if isinstance(resume.education, list) else []
        lines.append("\n**Education:**")
        for edu in edu_list:
            if isinstance(edu, dict):
                degree = edu.get("degree", "")
                field = edu.get("field", edu.get("major", ""))
                inst = edu.get("institution", edu.get("university", edu.get("college", "")))
                year = edu.get("year", edu.get("graduation_year", ""))
                gpa = edu.get("gpa", edu.get("cgpa", ""))
                entry = f"  - {degree} {field} — {inst}"
                if year:
                    entry += f" ({year})"
                if gpa:
                    entry += f", GPA: {gpa}"
                lines.append(entry)
            elif isinstance(edu, str):
                lines.append(f"  - {edu}")

    # Work Experience
    if resume.work_experience:
        exp_list = resume.work_experience if isinstance(resume.work_experience, list) else []
        lines.append("\n**Work Experience:**")
        for exp in exp_list:
            if isinstance(exp, dict):
                role = exp.get("role", exp.get("title", exp.get("position", "")))
                company = exp.get("company", exp.get("organization", ""))
                duration = exp.get("duration", exp.get("period", ""))
                desc = exp.get("description", exp.get("responsibilities", ""))
                entry = f"  - **{role}** at {company}"
                if duration:
                    entry += f" ({duration})"
                lines.append(entry)
                if desc:
                    if isinstance(desc, list):
                        for d in desc[:3]:
                            lines.append(f"    • {d}")
                    else:
                        lines.append(f"    {str(desc)[:200]}")
            elif isinstance(exp, str):
                lines.append(f"  - {exp}")

    # Projects
    if resume.projects:
        proj_list = resume.projects if isinstance(resume.projects, list) else []
        lines.append("\n**Projects:**")
        for proj in proj_list:
            if isinstance(proj, dict):
                name = proj.get("name", proj.get("title", "Project"))
                tech = proj.get("technologies", proj.get("tech_stack", proj.get("tools", [])))
                desc = proj.get("description", "")
                entry = f"  - **{name}**"
                if tech:
                    if isinstance(tech, list):
                        entry += f" (Tech: {', '.join(tech)})"
                    else:
                        entry += f" (Tech: {tech})"
                lines.append(entry)
                if desc:
                    lines.append(f"    {str(desc)[:200]}")
            elif isinstance(proj, str):
                lines.append(f"  - {proj}")

    # Certifications
    if resume.certifications:
        cert_list = resume.certifications if isinstance(resume.certifications, list) else []
        lines.append("\n**Certifications:**")
        for cert in cert_list:
            if isinstance(cert, dict):
                name = cert.get("name", cert.get("title", str(cert)))
                lines.append(f"  - {name}")
            elif isinstance(cert, str):
                lines.append(f"  - {cert}")

    # Internships (prior)
    if resume.internships:
        intern_list = resume.internships if isinstance(resume.internships, list) else []
        lines.append("\n**Internships:**")
        for intern in intern_list:
            if isinstance(intern, dict):
                role = intern.get("role", intern.get("title", ""))
                company = intern.get("company", intern.get("organization", ""))
                duration = intern.get("duration", "")
                entry = f"  - {role} at {company}"
                if duration:
                    entry += f" ({duration})"
                lines.append(entry)
            elif isinstance(intern, str):
                lines.append(f"  - {intern}")

    # Languages
    if resume.languages:
        lang_list = resume.languages if isinstance(resume.languages, list) else []
        if lang_list:
            lines.append(f"\n**Languages:** {', '.join(str(l) for l in lang_list)}")

    # Achievements
    if resume.achievements:
        ach_list = resume.achievements if isinstance(resume.achievements, list) else []
        if ach_list:
            lines.append("\n**Achievements/Awards:**")
            for ach in ach_list[:5]:
                lines.append(f"  - {ach if isinstance(ach, str) else str(ach)}")

    return "\n".join(lines) if lines else "Resume data is present but could not be fully extracted."


def generate_interview_agent_response(
    db: Session,
    session_id: uuid.UUID,
    resume_id: uuid.UUID | None,
    user_query: str,
) -> str:
    """
    Generate a personalized interview preparation response using the candidate's
    resume data as context.

    Args:
        db: Database session
        session_id: Chat session ID for history tracking
        resume_id: UUID of the resume to use as context (optional)
        user_query: The user's message/question

    Returns:
        The AI assistant's response as a string
    """
    # 1. Retrieve Conversation History
    history = get_chat_messages(db, session_id)
    langchain_messages = []

    # Keep last 8 messages (4 turns) to maintain context without hitting limits
    for msg in history[-8:]:
        if msg.role == "user":
            langchain_messages.append(HumanMessage(content=msg.message))
        elif msg.role == "assistant":
            langchain_messages.append(AIMessage(content=msg.message))

    # 2. Load and Format Resume Context
    resume = None
    if resume_id:
        resume = get_resume_by_id(db, resume_id)

    resume_context = _build_resume_context(resume)

    # 3. Build Prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", INTERVIEW_AGENT_SYSTEM_TEMPLATE),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{user_query}"),
    ])

    # 4. Invoke LLM
    if not settings.groq_api_key:
        return (
            "⚠️ The AI backend is not configured. Please add a valid `GROQ_API_KEY` "
            "to the `.env` file and restart the server."
        )

    llm = ChatGroq(
        api_key=settings.groq_api_key,
        model_name=settings.groq_model,
        temperature=0.5,  # slightly higher for more varied question generation
    )

    chain = prompt | llm

    response = chain.invoke({
        "resume_context": resume_context,
        "history": langchain_messages,
        "user_query": user_query,
    })

    return response.content
