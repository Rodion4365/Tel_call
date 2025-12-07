"""add_performance_indexes_for_queries

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2025-12-07 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add performance indexes for frequently queried columns."""
    conn = op.get_bind()
    inspector = inspect(conn)

    # Get existing indexes for each table
    friend_links_indexes = {idx['name'] for idx in inspector.get_indexes('friend_links')}
    participants_indexes = {idx['name'] for idx in inspector.get_indexes('participants')}
    call_stats_indexes = {idx['name'] for idx in inspector.get_indexes('call_stats')}

    # 1. Add index on friend_links.updated_at for sorting recent friends
    if 'ix_friend_links_updated_at' not in friend_links_indexes:
        op.create_index(
            'ix_friend_links_updated_at',
            'friend_links',
            ['updated_at'],
            postgresql_using='btree'
        )

    # 2. Add indexes on participants table for call and user lookups
    if 'ix_participants_call_id' not in participants_indexes:
        op.create_index(
            'ix_participants_call_id',
            'participants',
            ['call_id']
        )

    if 'ix_participants_user_id' not in participants_indexes:
        op.create_index(
            'ix_participants_user_id',
            'participants',
            ['user_id']
        )

    # Composite index for finding specific participant in a call
    if 'ix_participants_call_user' not in participants_indexes:
        op.create_index(
            'ix_participants_call_user',
            'participants',
            ['call_id', 'user_id']
        )

    # 3. Add index on call_stats.user_id for user statistics lookups
    if 'ix_call_stats_user_id' not in call_stats_indexes:
        op.create_index(
            'ix_call_stats_user_id',
            'call_stats',
            ['user_id']
        )


def downgrade() -> None:
    """Remove performance indexes."""
    conn = op.get_bind()
    inspector = inspect(conn)

    # Get existing indexes for each table
    friend_links_indexes = {idx['name'] for idx in inspector.get_indexes('friend_links')}
    participants_indexes = {idx['name'] for idx in inspector.get_indexes('participants')}
    call_stats_indexes = {idx['name'] for idx in inspector.get_indexes('call_stats')}

    # Drop indexes in reverse order
    if 'ix_call_stats_user_id' in call_stats_indexes:
        op.drop_index('ix_call_stats_user_id', table_name='call_stats')

    if 'ix_participants_call_user' in participants_indexes:
        op.drop_index('ix_participants_call_user', table_name='participants')

    if 'ix_participants_user_id' in participants_indexes:
        op.drop_index('ix_participants_user_id', table_name='participants')

    if 'ix_participants_call_id' in participants_indexes:
        op.drop_index('ix_participants_call_id', table_name='participants')

    if 'ix_friend_links_updated_at' in friend_links_indexes:
        op.drop_index('ix_friend_links_updated_at', table_name='friend_links')
