"""cleanup_invalid_friend_links

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2025-12-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Clean up invalid friend links that may cause crashes.

    This migration handles both old (user_id_1, user_id_2) and new (user_id, friend_id) schemas.
    """
    conn = op.get_bind()
    inspector = inspect(conn)

    # Check if table exists
    tables = inspector.get_table_names()
    if 'friend_links' not in tables:
        return

    # Get column names to determine schema version
    columns = {col['name'] for col in inspector.get_columns('friend_links')}

    # Handle old schema with user_id_1 and user_id_2
    if 'user_id_1' in columns and 'user_id_2' in columns:
        # Delete friend_links where user_id_1 doesn't exist in users table
        conn.execute(sa.text("""
            DELETE FROM friend_links
            WHERE user_id_1 NOT IN (SELECT id FROM users)
        """))

        # Delete friend_links where user_id_2 doesn't exist in users table
        conn.execute(sa.text("""
            DELETE FROM friend_links
            WHERE user_id_2 NOT IN (SELECT id FROM users)
        """))

        # Delete friend_links where user_id_1 = user_id_2 (self-links)
        conn.execute(sa.text("""
            DELETE FROM friend_links
            WHERE user_id_1 = user_id_2
        """))

    # Handle new schema with user_id and friend_id
    elif 'user_id' in columns and 'friend_id' in columns:
        # Delete friend_links where user_id doesn't exist in users table
        conn.execute(sa.text("""
            DELETE FROM friend_links
            WHERE user_id NOT IN (SELECT id FROM users)
        """))

        # Delete friend_links where friend_id doesn't exist in users table
        conn.execute(sa.text("""
            DELETE FROM friend_links
            WHERE friend_id NOT IN (SELECT id FROM users)
        """))

        # Delete friend_links where user_id = friend_id (self-links)
        conn.execute(sa.text("""
            DELETE FROM friend_links
            WHERE user_id = friend_id
        """))


def downgrade() -> None:
    """No downgrade needed for data cleanup."""
    pass
