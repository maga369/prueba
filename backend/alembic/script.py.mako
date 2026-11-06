"""Migration script template."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

${imports}
if ${type_annotation}:
    from typing import ${type_annotation}

${upgrades}

${downgrades}
