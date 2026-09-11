import uuid
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import schemas, crud, models
from app.routers.auth import get_current_user
from app.services.chatbot_service import generate_chat_response
from app.services.interview_agent_service import generate_interview_agent_response
from app.services.document_service import (
    extract_document_text,
    build_document_vectorstore,
    generate_document_qa_response,
)

router = APIRouter(
    prefix="/chat",
    tags=["chatbot"],
)

# ===========================================================================
# EXISTING CHATBOT ENDPOINTS (unchanged — floating widget still uses these)
# ===========================================================================

@router.post("/sessions", response_model=schemas.ChatSessionResponse)
def create_session(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new chat session for the current user."""
    return crud.create_chat_session(db, user_id=current_user.id)

@router.get("/sessions", response_model=List[schemas.ChatSessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all chat sessions for the current user."""
    return crud.get_chat_sessions(db, user_id=current_user.id)

@router.post("/sessions/{session_id}/message", response_model=schemas.ChatMessageResponse)
def send_message(
    session_id: uuid.UUID,
    payload: schemas.ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Send a message to the chatbot in a specific session."""
    session = crud.get_chat_session(db, session_id=session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Store user message
    user_msg = crud.create_chat_message(db, session_id=session.id, role="user", message=payload.message)
    
    # Generate and store bot response
    bot_response_text = generate_chat_response(db, session_id=session.id, user_query=payload.message)
    bot_msg = crud.create_chat_message(db, session_id=session.id, role="assistant", message=bot_response_text)
    
    return bot_msg


# ===========================================================================
# INTERVIEW PREPARATION AGENT ENDPOINTS (new)
# ===========================================================================

@router.post("/agent/sessions", response_model=schemas.ChatSessionResponse)
def create_agent_session(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new interview agent chat session for the current user."""
    return crud.create_chat_session(db, user_id=current_user.id)


@router.get("/agent/sessions", response_model=List[schemas.ChatSessionResponse])
def list_agent_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all agent sessions for the current user."""
    return crud.get_chat_sessions(db, user_id=current_user.id)


@router.post(
    "/agent/sessions/{session_id}/message",
    response_model=schemas.ChatMessageResponse,
)
def send_agent_message(
    session_id: uuid.UUID,
    payload: schemas.AgentChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Send a message to the Interview Preparation Agent.
    The agent uses the candidate's resume data as personalized context.
    
    - `message`: The user's question or request.
    - `resume_id`: (Optional) UUID of the resume to use as context.
      If provided, the agent tailors its responses to the candidate's
      skills, education, experience, and projects.
    """
    # Verify session belongs to current user
    session = crud.get_chat_session(db, session_id=session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Optionally verify resume belongs to current user
    resume_id = None
    if payload.resume_id:
        resume = crud.get_resume_by_id(db, payload.resume_id)
        if resume and resume.user_id == current_user.id:
            resume_id = payload.resume_id
        else:
            raise HTTPException(
                status_code=404,
                detail="Resume not found or does not belong to you",
            )

    # Store user message
    crud.create_chat_message(
        db, session_id=session.id, role="user", message=payload.message
    )

    # Generate personalized interview agent response
    bot_response_text = generate_interview_agent_response(
        db=db,
        session_id=session.id,
        resume_id=resume_id,
        user_query=payload.message,
    )

    # Store and return assistant message
    bot_msg = crud.create_chat_message(
        db, session_id=session.id, role="assistant", message=bot_response_text
    )

    return bot_msg


# ===========================================================================
# DOCUMENT Q&A ENDPOINTS (new)
# ===========================================================================

ALLOWED_DOC_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/document/upload",
    response_model=schemas.DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """
    Upload a PDF or DOCX document for Q&A.
    
    The document's text is extracted, chunked, and embedded into a temporary
    FAISS vectorstore. Returns a `doc_session_id` to use in subsequent
    /chat/document/{doc_session_id}/message requests.
    """
    content_type = file.content_type or ""
    filename = file.filename or "document"

    # Validate file type
    ext = filename.lower().split(".")[-1]
    if content_type not in ALLOWED_DOC_TYPES and ext not in ("pdf", "docx"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported.",
        )

    # Read file
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    # Extract text
    try:
        text = extract_document_text(file_bytes, content_type, filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to extract document text: {str(e)}"
        )

    # Build FAISS vectorstore
    try:
        doc_session_id = str(uuid.uuid4())
        chunk_count = build_document_vectorstore(text, doc_session_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to build document index: {str(e)}",
        )

    return schemas.DocumentUploadResponse(
        doc_session_id=doc_session_id,
        filename=filename,
        chunk_count=chunk_count,
        message=f"Document '{filename}' processed successfully into {chunk_count} chunks. You can now ask questions about it.",
    )


@router.post(
    "/document/{doc_session_id}/message",
    response_model=schemas.DocQAMessageResponse,
)
def send_document_qa_message(
    doc_session_id: str,
    payload: schemas.DocQAMessageCreate,
    current_user: models.User = Depends(get_current_user),
):
    """
    Ask a question about a previously uploaded document.
    Uses RAG to retrieve relevant chunks and generate a grounded answer.
    """
    try:
        answer = generate_document_qa_response(
            doc_session_id=doc_session_id,
            user_query=payload.message,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Document session not found. Please upload a document first.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer: {str(e)}",
        )

    return schemas.DocQAMessageResponse(
        doc_session_id=doc_session_id,
        question=payload.message,
        answer=answer,
    )
