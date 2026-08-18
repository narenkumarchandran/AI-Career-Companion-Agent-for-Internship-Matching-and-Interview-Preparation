"""
Internship Assistant — Streamlit Frontend
==========================================
A beautiful, multi-page Streamlit app for the RAG-powered internship matching system.

Pages:
  1. 🔐 Login / Register
  2. 📄 My Resumes
  3. 🎯 Find Internships (RAG Match)
  4. 🔍 Browse Catalog
  5. 🧪 Test Scenarios

Run with:
    streamlit run frontend/streamlit_app.py
"""

import math
import time

import requests
import streamlit as st

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE = "http://localhost:8000"

st.set_page_config(
    page_title="Internship Assistant",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Global CSS — premium dark glassmorphism design
# ---------------------------------------------------------------------------
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    /* ── Base ── */
    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }
    .stApp {
        background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #0f0c29 100%);
        min-height: 100vh;
    }

    /* ── Sidebar ── */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1a1a3e 0%, #12122e 100%);
        border-right: 1px solid rgba(255,255,255,0.08);
    }
    [data-testid="stSidebar"] .stButton > button {
        width: 100%;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        color: #e0e0f0;
        border-radius: 10px;
        padding: 0.6rem 1rem;
        font-size: 0.9rem;
        transition: all 0.2s;
        margin-bottom: 4px;
    }
    [data-testid="stSidebar"] .stButton > button:hover {
        background: rgba(99, 102, 241, 0.3);
        border-color: rgba(99, 102, 241, 0.6);
        transform: translateX(3px);
    }

    /* ── Cards ── */
    .glass-card {
        background: rgba(255,255,255,0.04);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        transition: transform 0.2s, border-color 0.2s;
    }
    .glass-card:hover {
        transform: translateY(-2px);
        border-color: rgba(99, 102, 241, 0.4);
    }

    /* ── Match badge colors ── */
    .badge-perfect  { background: linear-gradient(135deg,#10b981,#059669); color:#fff; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:600; }
    .badge-strong   { background: linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:600; }
    .badge-partial  { background: linear-gradient(135deg,#f59e0b,#d97706); color:#fff; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:600; }
    .badge-weak     { background: linear-gradient(135deg,#ef4444,#dc2626); color:#fff; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:600; }

    /* ── Skill chips ── */
    .chip-matched { display:inline-block; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4); color:#34d399; padding:2px 10px; border-radius:20px; font-size:0.75rem; margin:2px; }
    .chip-missing { display:inline-block; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); color:#f87171; padding:2px 10px; border-radius:20px; font-size:0.75rem; margin:2px; }
    .chip-skill   { display:inline-block; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.4); color:#a5b4fc; padding:2px 10px; border-radius:20px; font-size:0.75rem; margin:2px; }

    /* ── Score ring ── */
    .score-ring {
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        width:90px; height:90px; border-radius:50%;
        background: conic-gradient(from 0deg, var(--ring-color) var(--pct), rgba(255,255,255,0.06) var(--pct));
        font-weight:700; font-size:1.3rem; color:#fff;
    }

    /* ── Progress bars ── */
    .score-bar-wrap { display:flex; align-items:center; gap:8px; margin:4px 0; font-size:0.82rem; color:#9ca3af; }
    .score-bar-bg   { flex:1; background:rgba(255,255,255,0.06); border-radius:8px; height:6px; overflow:hidden; }
    .score-bar-fill { height:100%; border-radius:8px; }

    /* ── Hero title ── */
    .hero-title {
        font-size: 2.6rem; font-weight: 800;
        background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        margin-bottom: 0.25rem;
    }
    .hero-sub { color: #9ca3af; font-size: 1rem; margin-bottom: 2rem; }

    /* ── Inputs ── */
    .stTextInput input, .stSelectbox, .stTextArea textarea {
        background: rgba(255,255,255,0.05) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        border-radius: 10px !important;
        color: #e0e0f0 !important;
    }

    /* ── Primary button ── */
    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
        border: none !important;
        border-radius: 10px !important;
        color: white !important;
        font-weight: 600 !important;
        padding: 0.6rem 1.5rem !important;
        transition: all 0.2s !important;
    }
    .stButton > button[kind="primary"]:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(99,102,241,0.4);
    }

    /* ── Divider ── */
    hr { border-color: rgba(255,255,255,0.08); }

    /* ── Metric ── */
    [data-testid="stMetric"] { background: rgba(255,255,255,0.04); border-radius:12px; padding:1rem; border: 1px solid rgba(255,255,255,0.08); }

    /* ── Info/success/error boxes ── */
    .stAlert { border-radius: 12px !important; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Session state init
# ---------------------------------------------------------------------------
for key, val in {
    "token": None,
    "user": None,
    "page": "login",
    "resumes": [],
    "match_results": None,
    "selected_resume_id": None,
}.items():
    if key not in st.session_state:
        st.session_state[key] = val


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def api(method: str, path: str, **kwargs) -> requests.Response:
    """Thin wrapper around requests that injects the auth token."""
    headers = kwargs.pop("headers", {})
    if st.session_state.token:
        headers["Authorization"] = f"Bearer {st.session_state.token}"
    url = f"{API_BASE}{path}"
    return getattr(requests, method)(url, headers=headers, timeout=60, **kwargs)


def login(email: str, password: str) -> bool:
    try:
        r = api("post", "/auth/login", json={"email": email, "password": password})
        if r.status_code == 200:
            data = r.json()
            st.session_state.token = data["access_token"]
            me = api("get", "/auth/me")
            st.session_state.user = me.json() if me.ok else {"email": email}
            return True
        st.error(f"Login failed: {r.json().get('detail', r.text)}")
        return False
    except requests.ConnectionError:
        st.error("❌ Cannot reach the API server. Make sure uvicorn is running on port 8000.")
        return False


def register(full_name: str, email: str, password: str) -> bool:
    try:
        r = api("post", "/auth/register", json={"full_name": full_name, "email": email, "password": password})
        if r.status_code == 201:
            return True
        st.error(f"Registration failed: {r.json().get('detail', r.text)}")
        return False
    except requests.ConnectionError:
        st.error("❌ Cannot reach the API server.")
        return False


def fetch_resumes():
    r = api("get", "/resume/")
    if r.ok:
        st.session_state.resumes = r.json()
    return st.session_state.resumes


def upload_resume(file) -> dict | None:
    r = api("post", "/resume/upload", files={"file": (file.name, file, file.type)})
    if r.ok:
        return r.json()
    st.error(f"Upload failed: {r.json().get('detail', r.text)}")
    return None


def match_internships(resume_id: str, k: int = 5) -> dict | None:
    r = api("get", f"/internships/match/{resume_id}", params={"k": k})
    if r.ok:
        return r.json()
    st.error(f"Matching failed ({r.status_code}): {r.json().get('detail', r.text)}")
    return None


def delete_resume_api(resume_id: str) -> bool:
    r = api("delete", f"/resume/{resume_id}")
    if r.status_code == 204:
        return True
    st.error(f"Deletion failed ({r.status_code}): {r.text}")
    return False


def fetch_catalog() -> list:
    try:
        r = api("get", "/internships/")
        return r.json() if r.ok else []
    except Exception:
        return []


# ---------------------------------------------------------------------------
# UI helpers
# ---------------------------------------------------------------------------

def badge_html(label: str) -> str:
    cls = {
        "Perfect Match": "badge-perfect",
        "Strong Match": "badge-strong",
        "Partial Match": "badge-partial",
        "Weak Match": "badge-weak",
    }.get(label, "badge-partial")
    return f'<span class="{cls}">{label}</span>'


def score_bar(label: str, value: float, color: str):
    pct = int(value * 100)
    st.markdown(
        f"""
        <div class="score-bar-wrap">
            <span style="width:100px">{label}</span>
            <div class="score-bar-bg">
                <div class="score-bar-fill" style="width:{pct}%;background:{color}"></div>
            </div>
            <span style="width:36px;text-align:right;color:#e0e0f0;font-weight:600">{pct}%</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def match_card(m: dict, rank: int):
    pct = m["match_percentage"]
    color = "#10b981" if pct >= 65 else "#f59e0b" if pct >= 40 else "#ef4444"

    matched_chips = "".join(f'<span class="chip-matched">✅ {s}</span>' for s in m["matched_skills"])
    missing_chips = "".join(f'<span class="chip-missing">❌ {s}</span>' for s in m["missing_skills"])
    pref_chips = "".join(f'<span class="chip-skill">⭐ {s}</span>' for s in m.get("preferred_skills", []))

    st.markdown(
        f"""
        <div class="glass-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
            <div style="flex:1;min-width:200px">
              <div style="font-size:0.8rem;color:#9ca3af;margin-bottom:2px">#{rank} — {m['domain']}</div>
              <div style="font-size:1.25rem;font-weight:700;color:#e0e0f0">{m['role_title']}</div>
              <div style="font-size:1rem;color:#a5b4fc;font-weight:500">{m['company']}</div>
              <div style="font-size:0.85rem;color:#6b7280;margin-top:4px">
                📍 {m['location']} &nbsp;|&nbsp; 🏢 {m['mode']} &nbsp;|&nbsp;
                ⏱ {m['duration_weeks']}w &nbsp;|&nbsp; 💰 ₹{m['stipend_inr_per_month']:,}/mo
              </div>
              <div style="margin-top:6px;font-size:0.8rem;color:#6b7280">🎓 {m['min_education']}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="font-size:2rem;font-weight:800;color:{color}">{pct:.0f}%</div>
              {badge_html(m['match_label'])}
            </div>
          </div>

          <hr style="margin:12px 0;border-color:rgba(255,255,255,0.06)">

          <div style="font-size:0.82rem;color:#9ca3af;margin-bottom:8px">{m['description']}</div>
        """,
        unsafe_allow_html=True,
    )

    # Score breakdown
    c1, c2 = st.columns(2)
    with c1:
        score_bar("Skill", m["skill_score"], "#10b981")
        score_bar("Semantic", m["semantic_score"], "#6366f1")
    with c2:
        score_bar("Education", m["education_score"], "#f59e0b")
        score_bar("Location", m["location_score"], "#3b82f6")

    # Skill chips
    if m["matched_skills"] or m["missing_skills"]:
        st.markdown(
            f"""
            <div style="margin-top:10px">
              <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px">SKILLS</div>
              {matched_chips}{missing_chips}
            </div>
            """,
            unsafe_allow_html=True,
        )
    if m.get("preferred_skills"):
        st.markdown(
            f'<div style="margin-top:6px">{pref_chips}</div>',
            unsafe_allow_html=True,
        )

    st.markdown("</div>", unsafe_allow_html=True)


def resume_card(r: dict, show_match_button: bool = True) -> bool:
    """Renders a resume card. Returns True if the user clicked Match."""
    skills = r.get("skills") or []
    if isinstance(skills, list):
        skills_str = ", ".join(skills[:8]) + ("..." if len(skills) > 8 else "")
    else:
        skills_str = str(skills)[:100]

    edu = r.get("education") or []
    if isinstance(edu, list) and edu:
        first = edu[0]
        edu_str = first.get("degree", "") + (" @ " + first.get("institution", "") if first.get("institution") else "") if isinstance(first, dict) else str(first)
    else:
        edu_str = str(edu) if edu else "—"

    status_color = {"parsed": "#10b981", "pending": "#f59e0b", "failed": "#ef4444"}.get(r["parsed_status"], "#6b7280")

    st.markdown(
        f"""
        <div class="glass-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap">
            <div style="flex:1">
              <div style="font-size:1rem;font-weight:600;color:#e0e0f0">📄 {r['original_filename']}</div>
              <div style="font-size:0.82rem;color:#6b7280;margin-top:2px">
                👤 {r.get('full_name') or '—'} &nbsp;|&nbsp;
                📧 {r.get('email') or '—'} &nbsp;|&nbsp;
                📁 {r['content_type'].split('/')[-1].upper()} &nbsp;|&nbsp;
                {r['file_size'] // 1024} KB
              </div>
              <div style="font-size:0.82rem;color:#9ca3af;margin-top:4px">🎓 {edu_str}</div>
              <div style="font-size:0.8rem;color:#a5b4fc;margin-top:2px">{skills_str or 'No skills extracted'}</div>
            </div>
            <span style="color:{status_color};font-size:0.78rem;font-weight:600;padding:3px 10px;border:1px solid {status_color};border-radius:20px;align-self:flex-start">
              {r['parsed_status'].upper()}
            </span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if show_match_button:
        c1, c2 = st.columns([1, 1])
        with c1:
            if st.button("🎯 Find Matching Internships", key=f"match_{r['id']}", type="primary"):
                st.session_state.selected_resume_id = r["id"]
                st.session_state.page = "match"
                st.rerun()
        with c2:
            if st.button("🗑️ Delete Resume", key=f"delete_{r['id']}"):
                if delete_resume_api(r["id"]):
                    st.success("Resume deleted!")
                    fetch_resumes()
                    st.rerun()
    return False


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

def page_login():
    st.markdown('<div class="hero-title">🚀 Internship Assistant</div>', unsafe_allow_html=True)
    st.markdown('<div class="hero-sub">AI-powered internship matching — upload your resume and discover your best-fit opportunities</div>', unsafe_allow_html=True)

    tab1, tab2 = st.tabs(["🔐 Login", "📝 Register"])

    with tab1:
        with st.form("login_form"):
            email = st.text_input("Email", placeholder="you@example.com")
            password = st.text_input("Password", type="password", placeholder="••••••••")
            submitted = st.form_submit_button("Login", type="primary", use_container_width=True)
            if submitted:
                if login(email, password):
                    st.session_state.page = "resumes"
                    fetch_resumes()
                    st.rerun()

    with tab2:
        with st.form("register_form"):
            name = st.text_input("Full Name", placeholder="Jane Smith")
            email2 = st.text_input("Email", placeholder="you@example.com", key="reg_email")
            pass2 = st.text_input("Password (min 8 chars)", type="password", key="reg_pass")
            submitted2 = st.form_submit_button("Create Account", type="primary", use_container_width=True)
            if submitted2:
                if register(name, email2, pass2):
                    st.success("✅ Account created! Please log in.")


def page_resumes():
    st.markdown('<div class="hero-title">📄 My Resumes</div>', unsafe_allow_html=True)
    st.markdown('<div class="hero-sub">Upload your resume to start matching with internship opportunities</div>', unsafe_allow_html=True)

    # Upload section
    if "uploader_key" not in st.session_state:
        st.session_state.uploader_key = 0

    with st.expander("➕ Upload a New Resume", expanded=not st.session_state.resumes):
        uploaded = st.file_uploader("Select PDF or DOCX", type=["pdf", "docx", "doc"], key=f"uploader_{st.session_state.uploader_key}")
        if uploaded:
            with st.spinner("Uploading and parsing resume…"):
                result = upload_resume(uploaded)
            if result:
                st.success(f"✅ Resume uploaded and parsed! Found {len(result.get('skills') or [])} skills.")
                st.session_state.uploader_key += 1
                fetch_resumes()
                st.rerun()

    # List resumes
    resumes = fetch_resumes()
    if not resumes:
        st.info("No resumes uploaded yet. Use the uploader above to get started.")
        return

    st.markdown(f"**{len(resumes)} resume(s) on file:**")
    for r in resumes:
        resume_card(r, show_match_button=True)


def page_match():
    st.markdown('<div class="hero-title">🎯 Find Matching Internships</div>', unsafe_allow_html=True)
    st.markdown('<div class="hero-sub">RAG-powered semantic matching against 100+ internship opportunities</div>', unsafe_allow_html=True)

    resumes = fetch_resumes()
    if not resumes:
        st.warning("No resumes found. Please upload one first.")
        return

    # Resume selector
    resume_options = {r["original_filename"]: r["id"] for r in resumes}
    col1, col2, col3 = st.columns([3, 1, 1])
    with col1:
        selected_name = st.selectbox("Choose Resume", list(resume_options.keys()))
        resume_id = resume_options[selected_name]
    with col2:
        k = st.slider("Top K results", min_value=1, max_value=20, value=5)
    with col3:
        st.markdown("<br>", unsafe_allow_html=True)
        run_match = st.button("🔍 Match Now", type="primary", use_container_width=True)

    # Auto-run if navigated from resume card
    if st.session_state.selected_resume_id and st.session_state.selected_resume_id == resume_id:
        run_match = True
        st.session_state.selected_resume_id = None

    if run_match:
        with st.spinner("🧠 Embedding resume and searching vector store…"):
            result = match_internships(resume_id, k=k)
        if result:
            st.session_state.match_results = result
            st.session_state.match_results["_resume_name"] = selected_name

    # Show results
    results = st.session_state.match_results
    if not results:
        st.info("Click **Match Now** to find internships. Results will appear here.")
        return

    matches = results.get("results", [])
    query_skills = results.get("query_skills", "")
    summary = results.get("summary")

    # Summary banner
    if summary:
        st.markdown(
            f"""
            <div class="glass-card" style="border-color:rgba(99,102,241,0.3);background:rgba(99,102,241,0.08)">
              <div style="font-size:0.8rem;color:#a5b4fc;font-weight:600;margin-bottom:6px">🤖 AI MATCH SUMMARY</div>
              <div style="color:#e0e0f0;line-height:1.6">{summary}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Stats row
    if matches:
        avg_pct = sum(m["match_percentage"] for m in matches) / len(matches)
        perfect = sum(1 for m in matches if m["match_percentage"] >= 85)
        strong = sum(1 for m in matches if 65 <= m["match_percentage"] < 85)

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Matches Found", len(matches))
        c2.metric("Avg Match", f"{avg_pct:.1f}%")
        c3.metric("Perfect Matches", perfect)
        c4.metric("Strong Matches", strong)

        st.markdown("---")

        if query_skills:
            st.markdown(
                f'<div style="font-size:0.82rem;color:#6b7280;margin-bottom:1rem">🔍 Matched using skills: <span style="color:#a5b4fc">{query_skills}</span></div>',
                unsafe_allow_html=True,
            )

        for i, m in enumerate(matches, 1):
            match_card(m, i)
    else:
        st.warning("No matches found. The resume may not have enough extractable content.")


def page_browse():
    st.markdown('<div class="hero-title">🔍 Browse All Internships</div>', unsafe_allow_html=True)
    st.markdown('<div class="hero-sub">Explore the full internship catalog — filter by domain, mode, and location</div>', unsafe_allow_html=True)

    with st.spinner("Loading catalog…"):
        catalog = fetch_catalog()

    if not catalog:
        st.error("Could not load catalog. Is the API server running?")
        return

    # Filters
    col1, col2, col3, col4 = st.columns([2, 1, 1, 1])
    with col1:
        search = st.text_input("🔎 Search", placeholder="Python, ML, Backend…")
    with col2:
        domains = sorted({p["domain"] for p in catalog})
        domain_filter = st.selectbox("Domain", ["All"] + domains)
    with col3:
        modes = sorted({p["mode"] for p in catalog})
        mode_filter = st.selectbox("Mode", ["All"] + modes)
    with col4:
        cities = sorted({p["location"].split(",")[0] for p in catalog})
        city_filter = st.selectbox("City", ["All"] + cities)

    filtered = catalog
    if search:
        q = search.lower()
        filtered = [
            p for p in filtered
            if q in p["role_title"].lower()
            or q in p["description"].lower()
            or any(q in s.lower() for s in p["required_skills"])
            or any(q in s.lower() for s in p["preferred_skills"])
        ]
    if domain_filter != "All":
        filtered = [p for p in filtered if p["domain"] == domain_filter]
    if mode_filter != "All":
        filtered = [p for p in filtered if p["mode"] == mode_filter]
    if city_filter != "All":
        filtered = [p for p in filtered if p["location"].startswith(city_filter)]

    st.markdown(f"**{len(filtered)} of {len(catalog)} postings**")

    # Pagination
    per_page = 10
    total_pages = max(1, math.ceil(len(filtered) / per_page))
    page_num = st.number_input("Page", min_value=1, max_value=total_pages, value=1, step=1) - 1
    page_items = filtered[page_num * per_page: (page_num + 1) * per_page]

    for p in page_items:
        req_chips = "".join(f'<span class="chip-matched">{s}</span>' for s in p["required_skills"])
        pref_chips = "".join(f'<span class="chip-skill">{s}</span>' for s in p["preferred_skills"])
        st.markdown(
            f"""
            <div class="glass-card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap">
                <div style="flex:1">
                  <div style="font-size:0.78rem;color:#9ca3af">{p['domain']}</div>
                  <div style="font-size:1.1rem;font-weight:700;color:#e0e0f0">{p['role_title']}</div>
                  <div style="font-size:0.95rem;color:#a5b4fc">{p['company']}</div>
                  <div style="font-size:0.82rem;color:#6b7280;margin-top:4px">
                    📍 {p['location']} &nbsp;|&nbsp; 🏢 {p['mode']} &nbsp;|&nbsp;
                    ⏱ {p['duration_weeks']}w &nbsp;|&nbsp; 💰 ₹{p['stipend_inr_per_month']:,}/mo
                  </div>
                  <div style="font-size:0.78rem;color:#6b7280">🎓 {p['min_education']}</div>
                </div>
              </div>
              <div style="font-size:0.82rem;color:#9ca3af;margin:8px 0">{p['description']}</div>
              <div>{req_chips}{pref_chips}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def page_test_scenarios():
    st.markdown('<div class="hero-title">🧪 Test Scenarios</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="hero-sub">Upload any of these synthetic test profiles to validate the RAG pipeline across different matching scenarios</div>',
        unsafe_allow_html=True,
    )

    SCENARIOS = [
        {
            "name": "🐍 AI/ML Engineer",
            "category": "AI/ML Matching",
            "skills": ["Python", "TensorFlow", "PyTorch", "Machine Learning", "Deep Learning", "NLP", "Scikit-learn", "NumPy", "Pandas"],
            "education": "B.Tech in Computer Science, IIT Delhi",
            "summary": "Passionate ML engineer with experience building production NLP pipelines and computer vision models. Familiar with Hugging Face Transformers and LangChain.",
            "projects": [{"name": "Sentiment Analyzer", "tech_stack": "PyTorch, HuggingFace, FastAPI"}],
            "expected": "AI/ML, Data Science, NLP internships",
        },
        {
            "name": "🌐 Full-Stack Developer",
            "category": "Backend Development Matching",
            "skills": ["Python", "Django", "FastAPI", "Node.js", "React", "PostgreSQL", "Redis", "Docker", "REST API"],
            "education": "B.Tech in Information Technology",
            "summary": "Full-stack developer with 2 years of internship experience. Built e-commerce platforms and RESTful APIs serving 10k+ users.",
            "projects": [{"name": "E-Commerce Platform", "tech_stack": "React, Django, PostgreSQL, Redis"}],
            "expected": "Software Development, Backend, Full-Stack internships",
        },
        {
            "name": "📊 Data Science Analyst",
            "category": "Data Science Matching",
            "skills": ["Python", "SQL", "Pandas", "NumPy", "Tableau", "Power BI", "Data Analysis", "Machine Learning", "Excel"],
            "education": "M.Sc Statistics, Delhi University",
            "summary": "Data science graduate with strong statistical foundation. Experienced in building dashboards and predictive models for business insights.",
            "projects": [{"name": "Sales Forecasting Model", "tech_stack": "Python, Scikit-learn, Tableau"}],
            "expected": "Data Science, Business Analysis, Analytics internships",
        },
        {
            "name": "☁️ DevOps/Cloud Engineer",
            "category": "DevOps Matching",
            "skills": ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Linux", "Python", "Jenkins", "Azure"],
            "education": "B.Tech in Computer Engineering",
            "summary": "Cloud-native engineer specializing in containerization and infrastructure-as-code. Automated deployment pipelines reducing deployment time by 70%.",
            "projects": [{"name": "Kubernetes Auto-Scaler", "tech_stack": "Kubernetes, Terraform, AWS"}],
            "expected": "DevOps/Cloud, SRE internships",
        },
        {
            "name": "🤖 Generative AI Developer",
            "category": "Generative AI Matching",
            "skills": ["Python", "LangChain", "OpenAI API", "RAG", "Prompt Engineering", "Vector Databases", "FastAPI", "NLP"],
            "education": "M.Tech in AI & Machine Learning",
            "summary": "Gen AI engineer building production RAG pipelines and multi-agent systems. Experience with fine-tuning LLMs and building chatbots.",
            "projects": [{"name": "RAG Chatbot", "tech_stack": "LangChain, FAISS, OpenAI, FastAPI"}],
            "expected": "Gen AI, LLM, NLP internships",
        },
        {
            "name": "🎨 Frontend Developer",
            "category": "Frontend Matching",
            "skills": ["React", "TypeScript", "JavaScript", "HTML", "CSS", "Vue", "Angular", "Redux", "Tailwind CSS"],
            "education": "BCA in Computer Applications",
            "summary": "Frontend developer obsessed with user experience. Built accessible, performant web apps with modern React patterns.",
            "projects": [{"name": "Design System", "tech_stack": "React, TypeScript, Storybook"}],
            "expected": "Frontend, UI/UX, Web Development internships",
        },
        {
            "name": "🔒 Cybersecurity Analyst",
            "category": "Security Matching",
            "skills": ["Linux", "Networking", "SQL", "Python", "Penetration Testing", "OWASP", "AWS", "Docker"],
            "education": "B.Tech in Cybersecurity",
            "summary": "Security researcher with CTF competition experience. Skilled in vulnerability assessment and secure code review.",
            "projects": [{"name": "Vulnerability Scanner", "tech_stack": "Python, Nmap, OpenVAS"}],
            "expected": "Cybersecurity, AppSec internships",
        },
        {
            "name": "📱 Mobile Developer",
            "category": "Mobile Matching",
            "skills": ["React Native", "Flutter", "Kotlin", "Swift", "JavaScript", "Firebase", "REST API"],
            "education": "B.Tech in Computer Science",
            "summary": "Cross-platform mobile developer with apps published on Play Store and App Store. Experienced in push notifications, payments, and offline sync.",
            "projects": [{"name": "Food Delivery App", "tech_stack": "React Native, Node.js, Firebase"}],
            "expected": "Mobile, Android, iOS internships",
        },
    ]

    # Catalog needed to show expected domains
    with st.spinner("Loading catalog for preview…"):
        catalog = fetch_catalog()

    resumes = fetch_resumes()

    for i, scenario in enumerate(SCENARIOS):
        with st.expander(f"{scenario['name']} — {scenario['category']}", expanded=(i == 0)):
            c1, c2 = st.columns([3, 1])
            with c1:
                st.markdown(f"**Expected matches:** {scenario['expected']}")
                skills_html = "".join(f'<span class="chip-skill">{s}</span>' for s in scenario["skills"])
                st.markdown(
                    f"""
                    <div class="glass-card" style="padding:1rem">
                      <div style="font-size:0.78rem;color:#9ca3af;margin-bottom:6px">PROFILE OVERVIEW</div>
                      <div style="font-size:0.9rem;color:#e0e0f0;margin-bottom:8px">{scenario['summary']}</div>
                      <div style="font-size:0.78rem;color:#9ca3af;margin-bottom:4px">🎓 {scenario['education']}</div>
                      <div>{skills_html}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

            with c2:
                st.markdown("### Quick Match")
                # Simulate matching using the catalog
                if st.button(f"🔍 Simulate Match", key=f"sim_{i}"):
                    candidate_skills = {s.lower() for s in scenario["skills"]}
                    scored = []
                    for p in catalog:
                        req = p["required_skills"]
                        matched = [s for s in req if s.lower() in candidate_skills]
                        score = len(matched) / len(req) if req else 0
                        scored.append((score, p["role_title"], p["company"], p["domain"], matched))
                    scored.sort(reverse=True)
                    top5 = scored[:5]
                    for score, title, company, domain, matched in top5:
                        pct = int(score * 100)
                        color = "#10b981" if pct >= 65 else "#f59e0b" if pct >= 40 else "#ef4444"
                        st.markdown(
                            f"""
                            <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:8px 12px;margin:4px 0;border-left:3px solid {color}">
                              <div style="font-size:0.82rem;font-weight:600;color:#e0e0f0">{title}</div>
                              <div style="font-size:0.75rem;color:#9ca3af">{company} · {domain}</div>
                              <div style="font-size:0.75rem;color:{color}">{pct}% skill match</div>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )

            # Show matching resumes
            matching_resumes = [r for r in resumes if any(
                s.lower() in str(r.get("skills", [])).lower() for s in scenario["skills"][:3]
            )]
            if matching_resumes:
                st.markdown(f"**Found {len(matching_resumes)} similar resume(s) in your uploads:**")
                for r in matching_resumes[:2]:
                    if st.button(f"🎯 Match '{r['original_filename']}'", key=f"test_match_{i}_{r['id']}", type="primary"):
                        st.session_state.selected_resume_id = r["id"]
                        st.session_state.page = "match"
                        st.rerun()


# ---------------------------------------------------------------------------
# Sidebar navigation
# ---------------------------------------------------------------------------

def sidebar():
    with st.sidebar:
        st.markdown(
            """
            <div style="text-align:center;padding:1rem 0 0.5rem">
              <div style="font-size:2rem">🚀</div>
              <div style="font-size:1.1rem;font-weight:700;color:#e0e0f0">Internship Assistant</div>
              <div style="font-size:0.75rem;color:#6b7280">RAG-Powered Matching</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.markdown("---")

        if st.session_state.user:
            name = st.session_state.user.get("full_name") or st.session_state.user.get("email", "User")
            st.markdown(
                f'<div style="font-size:0.85rem;color:#9ca3af;text-align:center;padding:0.5rem 0">👤 {name}</div>',
                unsafe_allow_html=True,
            )

        pages = [
            ("📄", "My Resumes", "resumes"),
            ("🎯", "Find Internships", "match"),
            ("🔍", "Browse Catalog", "browse"),
            ("🧪", "Test Scenarios", "scenarios"),
        ]

        if st.session_state.token:
            for icon, label, page_key in pages:
                active = "→ " if st.session_state.page == page_key else ""
                if st.button(f"{icon} {active}{label}", key=f"nav_{page_key}"):
                    st.session_state.page = page_key
                    st.rerun()

            st.markdown("---")
            if st.button("🚪 Logout"):
                for key in ["token", "user", "resumes", "match_results", "selected_resume_id"]:
                    st.session_state[key] = None if key != "resumes" else []
                st.session_state.page = "login"
                st.rerun()
        else:
            if st.button("🔐 Login / Register"):
                st.session_state.page = "login"
                st.rerun()

        st.markdown("---")
        # API status indicator
        try:
            r = requests.get(f"{API_BASE}/", timeout=2)
            if r.ok:
                st.markdown('<div style="font-size:0.75rem;color:#10b981;text-align:center">🟢 API Online</div>', unsafe_allow_html=True)
            else:
                st.markdown('<div style="font-size:0.75rem;color:#ef4444;text-align:center">🔴 API Error</div>', unsafe_allow_html=True)
        except Exception:
            st.markdown('<div style="font-size:0.75rem;color:#f59e0b;text-align:center">🟡 API Offline</div>', unsafe_allow_html=True)

        st.markdown(
            '<div style="font-size:0.7rem;color:#374151;text-align:center;margin-top:1rem">Assignment 3 · RAG Pipeline</div>',
            unsafe_allow_html=True,
        )


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

sidebar()

if not st.session_state.token and st.session_state.page not in ("login",):
    st.session_state.page = "login"

page = st.session_state.page

if page == "login":
    page_login()
elif page == "resumes":
    page_resumes()
elif page == "match":
    page_match()
elif page == "browse":
    page_browse()
elif page == "scenarios":
    page_test_scenarios()
else:
    page_login()
