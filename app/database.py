# This file sets up the SQLAlchemy "plumbing": the engine (the actual
# connection to Postgres) and the Session factory (how we talk to the DB
# per-request). Every model in models.py inherits from `Base` defined here.
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# The engine manages the pool of connections to Postgres. It reads the
# connection string (user, password, host, db name) from DATABASE_URL in .env.
engine = create_engine(settings.database_url)

# A Session is a single "conversation" with the database (used to query,
# add, and commit changes). We create a *factory* here, not a session itself —
# a new Session is created per request via get_db() below.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class every ORM model (table) must inherit from.
# SQLAlchemy uses it to keep track of all defined tables so it knows what
# to create when we call Base.metadata.create_all() in main.py.
Base = declarative_base()


def get_db():
    """FastAPI dependency: opens one DB session per request and always
    closes it afterwards, even if the request raised an error.
    Usage in a route: `db: Session = Depends(get_db)`
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
