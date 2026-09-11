import uuid
from sqlalchemy.orm import Session
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from app.config import settings
from app.crud import get_chat_messages
from app.services.chatbot_rag import get_chatbot_vectorstore

SYSTEM_TEMPLATE = """You are InternAI, the official AI assistant for the Internship Assistant application.
You help students and early-career professionals understand how to use this platform to find internships that match their resumes.

Answer the user's questions based primarily on the provided Product Knowledge Context. 
If the information is not in the context, you can answer general questions about internships, resumes, and career advice, but clarify that it's general advice don't give answers to any specific questions.
Keep your answers clear, concise, and helpful. 

Product Knowledge Context:
{context}
"""

def generate_chat_response(db: Session, session_id: uuid.UUID, user_query: str) -> str:
    # 1. Retrieve Conversation History
    history = get_chat_messages(db, session_id)
    langchain_messages = []
    
    # Keep only the last 6 messages to stay well within context limits
    for msg in history[-6:]:
        if msg.role == "user":
            langchain_messages.append(HumanMessage(content=msg.message))
        elif msg.role == "assistant":
            langchain_messages.append(AIMessage(content=msg.message))
            
    # 2. Retrieve Relevant Product Info via RAG
    vectorstore = get_chatbot_vectorstore()
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
    
    docs = retriever.invoke(user_query)
    context_text = "\n\n".join([doc.page_content for doc in docs])
    
    # 3. Combine Context and History
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_TEMPLATE),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{user_query}")
    ])
    
    # 4. Invoke LLM
    if settings.groq_api_key:
        llm = ChatGroq(api_key=settings.groq_api_key, model_name=settings.groq_model, temperature=0.3)
    else:
        return "I'm sorry, my AI backend is not fully configured yet. Please provide a Groq API key in the .env file."
        
    chain = prompt | llm
    
    response = chain.invoke({
        "context": context_text,
        "history": langchain_messages,
        "user_query": user_query
    })
    
    return response.content
