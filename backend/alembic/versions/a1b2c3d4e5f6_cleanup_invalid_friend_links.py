"""cleanup_invalid_friend_links

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2025-12-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Clean up invalid friend links that may cause crashes."""
    conn = op.get_bind()

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


def downgrade() -> None:
    """No downgrade needed for data cleanup."""
    pass
