# Legal Redactor - Makefile
.PHONY: up down logs backend-shell db-shell migrate makemigrations seed test lint ci-db frontend-lint build-frontend

up:
	docker compose up -d --build

down:
	docker compose down -v

logs:
	docker compose logs -f backend

backend-shell:
	docker compose exec backend bash

db-shell:
	docker compose exec postgres psql -U legal -d legal_redactor

migrate:
	docker compose exec backend alembic upgrade head

makemigrations:
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

seed:
	docker compose exec backend python scripts/seed.py

test:
	docker compose exec backend pytest -v

lint:
	docker compose exec backend ruff check .
	docker compose exec backend mypy app

frontend-lint:
	docker compose exec frontend npm run lint

build-frontend:
	docker compose exec frontend npm run build

ci-db:
	docker compose -f docker-compose.ci.yml run --rm backend alembic upgrade head
	docker compose -f docker-compose.ci.yml run --rm backend pytest tests/db -v

# Development helpers
psql:
	docker compose exec postgres psql -U legal -d legal_redactor

redis-cli:
	docker compose exec redis redis-cli

minio-mc:
	docker run --rm --network legal-redactor-network minio/mc alias set local http://minio:9000 minioadmin minioadmin

# Full reset
reset: down up migrate seed
	@echo "✅ Stack reiniciado completamente"
