"""add_friend_links_table

Revision ID: e5f6a7b8c9d0
Revises: d1e2f3a4b5c6
Create Date: 2025-12-07 13:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if table already exists before creating
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()

    if 'friend_links' not in tables:
        op.create_table(
            'friend_links',
            sa.Column('user_id_1', sa.Integer(), nullable=False),
            sa.Column('user_id_2', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id_1'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id_2'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('user_id_1', 'user_id_2')
        )
        op.create_index('ix_friend_links_user_id_1', 'friend_links', ['user_id_1'])
        op.create_index('ix_friend_links_user_id_2', 'friend_links', ['user_id_2'])


def downgrade() -> None:
    # Check if table exists before dropping
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()

    if 'friend_links' in tables:
        op.drop_index('ix_friend_links_user_id_2', table_name='friend_links')
        op.drop_index('ix_friend_links_user_id_1', table_name='friend_links')
        op.drop_table('friend_links')
