"""add_photo_url_to_users

Revision ID: d1e2f3a4b5c6
Revises: c7a3d9e12f8b
Create Date: 2025-12-06 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'c7a3d9e12f8b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if column already exists before adding
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]

    if 'photo_url' not in columns:
        op.add_column('users', sa.Column('photo_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    # Check if column exists before dropping
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]

    if 'photo_url' in columns:
        op.drop_column('users', 'photo_url')
