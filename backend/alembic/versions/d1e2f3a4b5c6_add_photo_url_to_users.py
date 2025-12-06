"""add_photo_url_to_users

Revision ID: d1e2f3a4b5c6
Revises: c7a3d9e12f8b
Create Date: 2025-12-06 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'c7a3d9e12f8b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add photo_url column to users table
    op.add_column('users', sa.Column('photo_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    # Remove photo_url column from users table
    op.drop_column('users', 'photo_url')
