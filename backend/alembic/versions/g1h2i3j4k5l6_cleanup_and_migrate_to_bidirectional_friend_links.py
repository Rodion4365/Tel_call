"""cleanup_and_migrate_to_bidirectional_friend_links

Revision ID: g1h2i3j4k5l6
Revises: a1b2c3d4e5f6
Create Date: 2025-12-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'g1h2i3j4k5l6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Migrate friend_links table to bidirectional model.

    Instead of storing one symmetric record per friendship (min, max),
    we now store two records: (user_A, user_B) and (user_B, user_A).
    This simplifies queries and eliminates the need for UNION operations.
    """
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()

    # 1. Очистить данные звонков и участников
    if 'participants' in tables:
        conn.execute(sa.text("DELETE FROM participants"))

    if 'calls' in tables:
        conn.execute(sa.text("DELETE FROM calls"))

    # 2. Очистить и пересоздать таблицу friend_links
    if 'friend_links' in tables:
        # Удаляем старые индексы
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('friend_links')}

        if 'ix_friend_links_user_id_1' in existing_indexes:
            op.drop_index('ix_friend_links_user_id_1', table_name='friend_links')
        if 'ix_friend_links_user_id_2' in existing_indexes:
            op.drop_index('ix_friend_links_user_id_2', table_name='friend_links')
        if 'ix_friend_links_updated_at' in existing_indexes:
            op.drop_index('ix_friend_links_updated_at', table_name='friend_links')

        # Удаляем таблицу
        op.drop_table('friend_links')

    # 3. Создаём новую таблицу с двусторонней моделью
    # Теперь каждая дружба представлена ДВУМЯ записями: (A, B) и (B, A)
    op.create_table(
        'friend_links',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('friend_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['friend_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'friend_id')
    )

    # 4. Создаём индексы для оптимизации запросов
    # Индекс на user_id для быстрого поиска всех друзей пользователя
    op.create_index('ix_friend_links_user_id', 'friend_links', ['user_id'])

    # Индекс на updated_at для сортировки по времени последнего звонка
    op.create_index('ix_friend_links_updated_at', 'friend_links', ['updated_at'])


def downgrade() -> None:
    """
    Revert back to symmetric model.

    WARNING: This will lose all friend_links data!
    """
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()

    if 'friend_links' in tables:
        # Удаляем новые индексы
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('friend_links')}

        if 'ix_friend_links_user_id' in existing_indexes:
            op.drop_index('ix_friend_links_user_id', table_name='friend_links')
        if 'ix_friend_links_updated_at' in existing_indexes:
            op.drop_index('ix_friend_links_updated_at', table_name='friend_links')

        # Удаляем таблицу
        op.drop_table('friend_links')

    # Создаём старую таблицу с симметричной моделью
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
    op.create_index('ix_friend_links_updated_at', 'friend_links', ['updated_at'])
