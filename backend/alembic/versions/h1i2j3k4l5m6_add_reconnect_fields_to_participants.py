"""add_reconnect_fields_to_participants

Revision ID: h1i2j3k4l5m6
Revises: g1h2i3j4k5l6
Create Date: 2025-12-21 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from datetime import datetime, timezone


# revision identifiers, used by Alembic.
revision = 'h1i2j3k4l5m6'
down_revision = 'g1h2i3j4k5l6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if columns already exist before adding
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('participants')]

    if 'connection_status' not in columns:
        # Add connection_status column with default value 'connected'
        op.add_column(
            'participants',
            sa.Column(
                'connection_status',
                sa.String(length=20),
                nullable=False,
                server_default='connected'
            )
        )
        print("Added column 'connection_status' to participants table")

    if 'reconnect_deadline' not in columns:
        # Add reconnect_deadline column (nullable)
        op.add_column(
            'participants',
            sa.Column(
                'reconnect_deadline',
                sa.DateTime(timezone=True),
                nullable=True
            )
        )
        print("Added column 'reconnect_deadline' to participants table")


def downgrade() -> None:
    # Check if columns exist before dropping
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('participants')]

    if 'reconnect_deadline' in columns:
        op.drop_column('participants', 'reconnect_deadline')
        print("Dropped column 'reconnect_deadline' from participants table")

    if 'connection_status' in columns:
        op.drop_column('participants', 'connection_status')
        print("Dropped column 'connection_status' from participants table")
