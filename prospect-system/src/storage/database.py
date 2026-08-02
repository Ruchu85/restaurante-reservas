from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from src.storage.db_models import Base


_engine = None
_SessionLocal = None


def init_db(database_url: str) -> None:
    global _engine, _SessionLocal

    if database_url.startswith("sqlite"):
        db_path = database_url.replace("sqlite:///", "")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    _engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
        echo=False,
    )

    if "sqlite" in database_url:
        @event.listens_for(_engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    Base.metadata.create_all(_engine)

    if "sqlite" in database_url:
        _run_sqlite_migrations(_engine)

    _SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


def _run_sqlite_migrations(engine) -> None:
    """
    Añade columnas introducidas después del esquema inicial sin perder datos.

    `create_all` crea tablas nuevas pero nunca altera las existentes, así que
    una base de datos creada con una versión anterior necesita este paso.
    """
    new_columns = {
        "leads": [
            ("whatsapp_status", "TEXT"),
            ("whatsapp_sent_at", "DATETIME"),
        ],
    }

    with engine.connect() as conn:
        for table, columns in new_columns.items():
            existing = {
                row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))
            }
            if not existing:
                continue  # la tabla aún no existe
            for name, column_type in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {column_type}"))
        conn.commit()


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context manager that yields a Session and closes it automatically."""
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized — call init_db() first.")
    session: Session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
