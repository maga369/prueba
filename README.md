# Legal Redactor - iCAT

Aplicacion web para anonimizacion de documentos legales/medicos con flujo de revision humana y aprobacion. Desarrollada para el personal de iCAT.

## Inicio Rapido

### Prerrequisitos
- Docker 24+ y Docker Compose 2+
- 8 GB RAM minimo (16 GB recomendado para OCR)
- Puertos libres: 5050, 5173, 5432, 6379, 8000, 8080, 9000, 9001, 3000, 3001

### Levantar todo el stack
```bash
# Clonar y configurar
git clone <repo>
cd legal-redactor
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Levantar servicios (primera vez tarda ~5-10 min descargando imagenes y modelos)
make up

# Ejecutar migraciones y seed
make migrate
make seed
```

### URLs de acceso
| Servicio | URL | Credenciales |
|----------|-----|--------------|
| Frontend | http://localhost:5173 | Keycloak SSO |
| Backend API | http://localhost:8000 | - |
| API Docs (Swagger) | http://localhost:8000/docs | - |
| pgAdmin | http://localhost:5050 | admin@icat.cat / admin_pass |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| Keycloak | http://localhost:8080 | admin / admin |
| Presidio Analyzer | http://localhost:3000/health | - |
| Presidio Anonymizer | http://localhost:3001/health | - |

### Primer login
1. Abrir http://localhost:5173
2. Click "Iniciar sesion con Keycloak"
3. En Keycloak: crear usuario o usar marina@icat.cat (creado por seed)
4. Redirige automaticamente al Dashboard

## Arquitectura

Frontend (React) -> Backend (FastAPI) -> Workers (Celery) -> Storage (MinIO)
                          |                    |
                   PostgreSQL (Marina)    Redis (Kevin)
                          |
                   Presidio (Alex/Yaser)

## Roles del Equipo

| Rol | Responsable | Area |
|-----|-------------|------|
| Backend | Ruben | API, Auth, Workers, Integraciones |
| Frontend | Alex | UI, PDF Viewer, OCR Integration |
| OCR | Alex | PaddleOCR, PyMuPDF, Text Extraction |
| Base de Datos | Marina | Esquema, Migraciones, Seeds, Performance |
| ETL / Pipeline | Yaser | OCR -> PII -> Rules -> Redaction -> Export |
| DevOps | Kevin | Docker, CI/CD, K8s, Monitoring |
| Testing | Todos | Unit, Integration, E2E, IA Evaluation |

## Estructura del Proyecto

legal-redactor/
├── docker-compose.yml          # Stack completo desarrollo
├── Makefile                    # Comandos utiles
├── README.md
├── docs/                       # Documentacion
│   ├── 01-funcional-spec.md
│   ├── 02-technical-approach.md
│   ├── 03-ui-mockups.md
│   └── 04-test-plan.md
├── backend/
│   ├── app/
│   │   ├── api/               # Endpoints REST
│   │   ├── core/              # Config, DB, Security, Logging
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # OCR, PII, PDF Redaction, Storage
│   │   ├── workers/           # Celery tasks
│   │   └── main.py            # Entry point
│   ├── alembic/               # Migraciones BD
│   ├── scripts/               # Seed, utilidades
│   ├── tests/                 # Tests unitarios/integracion
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/        # UI components (Layout, PDF Viewer, etc.)
│   │   ├── pages/             # Dashboard, DocumentView, ApprovalView, Admin
│   │   ├── services/          # API clients (TanStack Query)
│   │   ├── hooks/             # useAuth, etc.
│   │   ├── types/             # TypeScript interfaces
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── .env.example
└── storage/                   # Volumen local para archivos (desarrollo)

## Comandos Utiles (Makefile)

```bash
# Desarrollo
make up              # Levantar stack completo
make down            # Parar y limpiar volumenes
make logs            # Ver logs backend
make backend-shell   # Shell en contenedor backend
make db-shell        # psql en PostgreSQL
make migrate         # Ejecutar migraciones Alembic
make makemigrations msg="descripcion"  # Crear migracion
make seed            # Poblar BD con datos iniciales
make test            # Tests backend
make lint            # Ruff + MyPy

# Frontend
make frontend-lint   # ESLint
make build-frontend  # Build produccion

# Reset completo
make reset           # down + up + migrate + seed
```

## Testing

```bash
# Backend tests
make test

# IA Evaluation (requiere dataset gold en ml/data/)
make eval-pii

# E2E (requiere staging)
make test-e2e

# Performance
make perf-test

# Security scan
make security-scan
```

## Flujo de Trabajo (Workflow)

1. Subida: Transcriptor arrastra PDF/imagen -> MinIO + BD UPLOADED
2. OCR: Worker extrae texto + bboxes (PaddleOCR o PyMuPDF nativo) -> OCR_DONE
3. PII Detection: Presidio + spaCy + recognizers custom detecta entidades -> PII_DONE
4. Revision: Transcriptor ve PDF + lista entidades -> marca acciones (R/M/G/K/P) -> IN_REVIEW
5. Envio: Si 0 pendientes -> READY_FOR_APPROVAL
6. Aprobacion: Aprobador ve preview redactado -> Aprueba/Rechaza -> APPROVED/REJECTED
7. Exportacion: Workers generan PDF redactado (PyMuPDF burn) + texto limpio -> EXPORTED
8. Descarga: Usuario descarga PDF/TXT + log Auditoria completo

## Seguridad

- Autenticacion: Keycloak OIDC + PKCE + Refresh tokens
- Autorizacion: RBAC (transcriptor/aprobador/admin) + RLS PostgreSQL
- Redaccion: PyMuPDF apply_redactions - quema pixeles (certificado NIST)
- Auditoria: Append-only audit_log con hash encadenado opcional
- Datos: Nunca salen del servidor (Presidio local, OCR local, LLM opcional)

## Modelos IA Utilizados

| Componente | Modelo | Tamano | Notas |
|------------|--------|--------|-------|
| OCR | PaddleOCR PP-OCRv3 mobile (es) | ~13 MB | CPU, 300 DPI |
| NER | spaCy es_core_news_lg | ~500 MB | Pipeline completo |
| PII Engine | Microsoft Presidio | Incluido | Analyzer + Anonymizer |
| Custom Recognizers | Regex + checksum (DNI/NIE/CIF/CIP) | - | Validacion matematica |
| LLM Fallback | GPT-4o-mini (opcional) | Cloud | Solo validacion ambigua |

## Metricas Objetivo IA

| Entidad | Recall | Precision | F1 |
|---------|--------|-----------|-----|
| DNI/NIE/CIF | > 99% | > 98% | > 98.5% |
| PERSON | > 95% | > 94% | > 94.5% |
| PHONE/EMAIL | > 97% | > 96% | > 96.5% |
| CAT_CIP | > 95% | > 95% | > 95% |
| Global Critico | > 99% | > 95% | > 97% |

## Despliegue Produccion

Kubernetes (ArgoCD GitOps)

Variables criticas produccion:
- SECRET_KEY: 64 chars aleatorios
- KEYCLOAK_CLIENT_SECRET: rotar periodicamente
- MINIO_SECURE: true (TLS)
- DATABASE_URL: managed PostgreSQL (RDS/CloudSQL)
- REDIS_URL: managed Redis (ElastiCache)
- CORS_ORIGINS: dominio real

## Documentacion

- Especificacion Funcional (docs/01-funcional-spec.md)
- Enfoque Tecnico / ADRs (docs/02-technical-approach.md)
- Maquetas UI (docs/03-ui-mockups.md)
- Plan de Pruebas (docs/04-test-plan.md)

## Contribucion

1. Fork + rama feature/nombre o fix/nombre
2. make lint + make test pasan
3. Commit convencional: feat:, fix:, docs:, refactor:
4. PR con descripcion y tests
5. Code review obligatorio (1 aprobacion minima)

## Licencia

Proyecto interno iCAT - Uso restringido al personal autorizado.
