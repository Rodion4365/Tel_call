"""Reset friend links schema and clear calls

Revision ID: b9f1d2c3e4f5
Revises: a1b2c3d4e5f6
Create Date: 2025-12-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

# revision identifiers, used by Alembic.
revision = "b9f1d2c3e4f5"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def _table_exists(inspector: inspect, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # Очистка данных звонков и участников, чтобы не оставалось старых связок друзей
    if _table_exists(inspector, "participants"):
        op.execute(text("DELETE FROM participants"))
    if _table_exists(inspector, "calls"):
        op.execute(text("DELETE FROM calls"))

    # Пересоздаём таблицу связей друзей с новым первичным ключом
    if _table_exists(inspector, "friend_links"):
        op.drop_table("friend_links")

    op.create_table(
        "friend_links",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("friend_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["friend_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "friend_id", name="uq_friend_links_user_friend"),
    )
    op.create_index("ix_friend_links_user_id", "friend_links", ["user_id"], postgresql_using="btree")
    op.create_index("ix_friend_links_friend_id", "friend_links", ["friend_id"], postgresql_using="btree")
    op.create_index("ix_friend_links_updated_at", "friend_links", ["updated_at"], postgresql_using="btree")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if _table_exists(inspector, "friend_links"):
        op.drop_index("ix_friend_links_updated_at", table_name="friend_links")
        op.drop_index("ix_friend_links_friend_id", table_name="friend_links")
        op.drop_index("ix_friend_links_user_id", table_name="friend_links")
        op.drop_table("friend_links")

    op.create_table(
        "friend_links",
        sa.Column("user_id_1", sa.Integer(), nullable=False),
        sa.Column("user_id_2", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id_1"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id_2"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id_1", "user_id_2"),
    )
    op.create_index("ix_friend_links_user_id_1", "friend_links", ["user_id_1"])
    op.create_index("ix_friend_links_user_id_2", "friend_links", ["user_id_2"])
    op.create_index("ix_friend_links_updated_at", "friend_links", ["updated_at"], postgresql_using="btree")
