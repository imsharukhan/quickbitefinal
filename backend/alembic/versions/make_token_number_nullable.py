"""make token_number nullable

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2026-04-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'da0c9d903382'  # ← replace with your latest revision ID
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column('orders', 'token_number',
        existing_type=sa.Integer(),
        nullable=True
    )

def downgrade():
    op.alter_column('orders', 'token_number',
        existing_type=sa.Integer(),
        nullable=False
    )