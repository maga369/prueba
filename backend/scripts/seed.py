#!/usr/bin/env python3
"""Seed script for initial data."""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.user import User
from app.models.rule import WithdrawalRule
from app.models.enums import UserRole, EntityAction


DATABASE_URL = settings.DATABASE_URL

# Base rules for iCAT documents
BASE_RULES = [
    {
        "name": "DNI español",
        "entity_type": "ES_NIF",
        "pattern_regex": r"\b[0-9]{8}[A-HJ-NP-TV-Z]\b",
        "action": EntityAction.REMOVE,
        "config": {},
    },
    {
        "name": "NIE español",
        "entity_type": "ES_NIE",
        "pattern_regex": r"\b[XYZ][0-9]{7}[A-HJ-NP-TV-Z]\b",
        "action": EntityAction.REMOVE,
        "config": {},
    },
    {
        "name": "CIF empresa",
        "entity_type": "ES_CIF",
        "pattern_regex": r"\b[A-HJ-NP-SUVW][0-9]{7}[0-9A-J]\b",
        "action": EntityAction.REMOVE,
        "config": {},
    },
    {
        "name": "Tarjeta Sanitària Catalunya (CIP)",
        "entity_type": "CAT_CIP",
        "pattern_regex": r"\b[0-9]{10}\b",
        "action": EntityAction.REMOVE,
        "config": {"context_keywords": ["cip", "tarjeta", "sanitària", "salut"]},
    },
    {
        "name": "IBAN",
        "entity_type": "IBAN_CODE",
        "pattern_regex": None,
        "action": EntityAction.REMOVE,
        "config": {},
    },
    {
        "name": "Teléfono España",
        "entity_type": "PHONE_NUMBER",
        "pattern_regex": r"(\+34|0034)?[679][0-9]{8}",
        "action": EntityAction.REMOVE,
        "config": {},
    },
    {
        "name": "Email",
        "entity_type": "EMAIL_ADDRESS",
        "pattern_regex": None,
        "action": EntityAction.REMOVE,
        "config": {},
    },
    {
        "name": "Persona (nombres)",
        "entity_type": "PERSON",
        "pattern_regex": None,
        "action": EntityAction.REMOVE,
        "config": {},
    },
    {
        "name": "Dirección",
        "entity_type": "LOCATION",
        "pattern_regex": None,
        "action": EntityAction.REMOVE,
        "config": {},
    },
    {
        "name": "Fecha (generalizar a año)",
        "entity_type": "DATE_TIME",
        "pattern_regex": None,
        "action": EntityAction.GENERALIZE,
        "config": {"date_format": "YYYY"},
    },
    {
        "name": "Diagnóstico CIE-10 (mantener)",
        "entity_type": "ICD10",
        "pattern_regex": r"^[A-TV-Z][0-9]{2}(\.[0-9]{1,4})?$",
        "action": EntityAction.KEEP,
        "config": {},
    },
    {
        "name": "Médico firmante (pseudonimizar)",
        "entity_type": "PERSON",
        "pattern_regex": r"^(Dr\.|Dra\.|Dr )",
        "action": EntityAction.PSEUDONYMIZE,
        "config": {"prefix": "Dr. "},
    },
    {
        "name": "Centro sanitario (pseudonimizar)",
        "entity_type": "LOCATION",
        "pattern_regex": r"(Hospital|Centro|CAP|Clínica)",
        "action": EntityAction.PSEUDONYMIZE,
        "config": {"prefix": "Centro "},
    },
    {
        "name": "Nº expediente (mantener)",
        "entity_type": "EXPEDIENTE",
        "pattern_regex": r"\bEXP[-/][0-9]{4,}\b",
        "action": EntityAction.KEEP,
        "config": {},
    },
    {
        "name": "Nº colegiado (pseudonimizar)",
        "entity_type": "COLEGIADO",
        "pattern_regex": r"\bCOL[-/][0-9]{4,}\b",
        "action": EntityAction.PSEUDONYMIZE,
        "config": {"prefix": "COL-"},
    },
]


async def main():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Create admin user
        admin_id = uuid.uuid4()
        trans_id = uuid.uuid4()
        aprob_id = uuid.uuid4()

        users_data = [
            (admin_id, "admin@icat.cat", "Admin iCAT", UserRole.ADMIN),
            (trans_id, "marina@icat.cat", "Marina Gallego", UserRole.TRANSCRIPTOR),
            (aprob_id, "aprobador@icat.cat", "Aprobador Test", UserRole.APROBADOR),
        ]

        for uid, email, name, role in users_data:
            user = User(
                id=uid,
                keycloak_sub=f"kc-{uid}",
                email=email,
                full_name=name,
                role=role,
            )
            db.add(user)

        await db.flush()

        # Create rules
        for rule_data in BASE_RULES:
            rule = WithdrawalRule(
                id=uuid.uuid4(),
                name=rule_data["name"],
                entity_type=rule_data["entity_type"],
                pattern_regex=rule_data["pattern_regex"],
                action=rule_data["action"],
                config=rule_data["config"],
                is_active=True,
                version=1,
                created_by=admin_id,
            )
            db.add(rule)

        await db.commit()
        print("✅ Seed completed successfully!")
        print(f"   Users: {len(users_data)}")
        print(f"   Rules: {len(BASE_RULES)}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
