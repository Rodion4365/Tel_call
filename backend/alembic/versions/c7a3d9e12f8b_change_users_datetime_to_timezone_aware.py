"""Change users datetime columns to timezone-aware

Revision ID: c7a3d9e12f8b
Revises: fb958ba03c93
Create Date: 2025-12-05 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7a3d9e12f8b'
down_revision: Union[str, None] = 'fb958ba03c93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change users.created_at and users.updated_at to TIMESTAMP WITH TIME ZONE."""
    # PostgreSQL: ALTER COLUMN to add timezone
    # SQLite does not support ALTER COLUMN, and datetime columns are timezone-aware by default
    # when using DateTime(timezone=True) in SQLAlchemy models, so no migration needed for SQLite
    connection = op.get_bind()
    if connection.dialect.name == 'postgresql':
        op.execute('ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE \'UTC\'')
        op.execute('ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE \'UTC\'')


def downgrade() -> None:
    """Revert users.created_at and users.updated_at to TIMESTAMP WITHOUT TIME ZONE."""
    # PostgreSQL: ALTER COLUMN to remove timezone
    # SQLite does not need this migration
    connection = op.get_bind()
    if connection.dialect.name == 'postgresql':
        op.execute('ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE')
        op.execute('ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMP WITHOUT TIME ZONE')
