"""Withdrawal rules management endpoints."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.rule import WithdrawalRule
from app.models.entity import DetectedEntity
from app.schemas.rule import RuleCreate, RuleRead, RuleUpdate, RuleList

router = APIRouter(prefix="/rules", tags=["rules"])


@router.post("", response_model=RuleRead, status_code=status.HTTP_201_CREATED)
async def create_rule(
    rule: RuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Create a new withdrawal rule."""
    user_id = uuid.UUID(current_user["sub"])

    db_rule = WithdrawalRule(
        **rule.model_dump(),
        created_by=user_id,
    )
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)

    return db_rule


@router.get("", response_model=List[RuleList])
async def list_rules(
    entity_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """List withdrawal rules."""
    query = select(WithdrawalRule)

    if entity_type:
        query = query.where(WithdrawalRule.entity_type == entity_type)
    if is_active is not None:
        query = query.where(WithdrawalRule.is_active == is_active)

    query = query.order_by(WithdrawalRule.entity_type, WithdrawalRule.version.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    rules = result.scalars().all()

    return [
        RuleList(
            id=r.id,
            name=r.name,
            entity_type=r.entity_type,
            action=r.action,
            is_active=r.is_active,
            version=r.version,
            created_at=r.created_at,
        )
        for r in rules
    ]


@router.get("/{rule_id}", response_model=RuleRead)
async def get_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """Get a specific rule."""
    result = await db.execute(
        select(WithdrawalRule).where(WithdrawalRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(404, "Rule not found")

    return rule


@router.patch("/{rule_id}", response_model=RuleRead)
async def update_rule(
    rule_id: uuid.UUID,
    update: RuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Update a rule (creates new version)."""
    user_id = uuid.UUID(current_user["sub"])

    result = await db.execute(
        select(WithdrawalRule).where(WithdrawalRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(404, "Rule not found")

    # Update fields
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    # Increment version
    rule.version += 1
    rule.created_by = user_id

    await db.commit()
    await db.refresh(rule)

    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Deactivate a rule (soft delete)."""
    result = await db.execute(
        select(WithdrawalRule).where(WithdrawalRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(404, "Rule not found")

    # Check if rule is in use
    usage = await db.execute(
        select(func.count(DetectedEntity.id)).where(DetectedEntity.rule_id == rule_id)
    )
    if usage.scalar() > 0:
        # Soft delete - just deactivate
        rule.is_active = False
        await db.commit()
    else:
        # Hard delete if not used
        await db.delete(rule)
        await db.commit()


@router.get("/entity-types/list")
async def list_entity_types(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("transcriptor", "aprobador", "admin")),
):
    """Get list of all entity types used in rules."""
    result = await db.execute(
        select(WithdrawalRule.entity_type).distinct()
    )
    types = [row[0] for row in result.all()]
    return {"entity_types": sorted(types)}
