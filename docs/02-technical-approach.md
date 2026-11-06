# Enfoque Técnico - Legal Redactor iCAT

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY (FastAPI)                            │
│  Auth (Keycloak OIDC) │ Rate Limit │ OpenAPI Docs │ WebSocket (notific.)  │
└─────────────────────────────────────────────────────────────────────────────┘
          │                    │                    │                    │
    ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐
    │  MÓDULO   │        │  MÓDULO   │        │  MÓDULO   │        │  MÓDULO   │
    │  INGESTA  │        │    OCR    │        │    PII    │        │ WORKFLOW  │
    │ (Rubén)   │        │  (Alex)   │        │  (Yaser)  │        │ (Rubén)   │
    └───────────┘        └───────────┘        └───────────┘        └───────────┘
          │                    │                    │                    │
    ┌─────▼────────────────────▼────────────────────▼────────────────────▼─────┐
    │                        EVENT BUS (Redis Streams)                         │
    │  DocumentUploaded → OcrCompleted → PiiDetected → ReadyForReview →       │
    │  ReviewSubmitted → Approved → ExportGenerated → AuditLogged              │
    └───────────────────────────────────────────────────────────────────────────┘
          │                    │                    │                    │
    ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐
    │  STORAGE  │        │  POSTGRES │        │  MINIO/S3 │        │  REDIS    │
    │  (Kevin)  │        │ (Marina)  │        │  (Kevin)  │        │  (Kevin)  │
    │  PDFs,    │        │  Docs,    │        │  Blobs    │        │  Colas,   │
    │  exports  │        │  usuarios,│        │  grandes  │        │  cache,   │
    │           │        │  reglas,  │        │           │        │  sesiones │
    │           │        │  auditoría│        │           │        │           │
    └───────────┘        └───────────┘        └───────────┘        └───────────┘
```

## 2. Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind | DX moderno, componentes accesibles, bundle optimizado |
| **State/Query** | TanStack Query + Zustand | Cache servidor automático, estado global simple |
| **PDF Viewer** | pdfjs-dist (Mozilla) | Renderizado canvas nativo, sincronización coordenadas |
| **Backend** | FastAPI (Python 3.12) | Async nativo, OpenAPI automático, integración directa IA/ML |
| **Auth** | Keycloak 24 + OIDC | Estándar enterprise, SSO futuro, roles, gratis on-prem |
| **Queue** | Celery + Redis + RedBeat | Procesamiento async PDF pesado, tareas programadas, retry/backoff |
| **DB** | PostgreSQL 16 + SQLAlchemy 2.0 async | ACID, JSONB, índices parciales, particionado, triggers auditoría |
| **OCR** | PaddleOCR v3 mobile (español) | Mejor precisión ES/CA vs Tesseract; gratis; on-premise; layout analysis |
| **PII Engine** | Microsoft Presidio + spaCy `es_core_news_lg` | Estándar open source anonimización; 50+ entidades; extensible recognizers custom |
| **Redaction** | PyMuPDF 1.22.0 (MIT) | Única librería Python que *quema* píxeles (NIST certificado); bboxes exactos |
| **Storage** | MinIO (S3-compatible) | Object storage local, versionado, presigned URLs, compatible cloud |
| **Deploy** | Docker Compose (dev) → Kubernetes + ArgoCD (prod) | Infra como código, GitOps, rollback fácil, escalado horizontal |
| **Observabilidad** | Prometheus + Grafana + Structlog | Métricas RED, logs estructurados JSON, alerting |

## 3. Decisiones Clave (ADRs)

### ADR-001: Procesamiento Asíncrono con Celery
**Decisión**: Usar Celery + Redis para OCR, PII, Redaction, Export
**Por qué**: PDFs de 50+ páginas toman minutos; FastAPI async solo cubre I/O, no CPU-bound; Celery da retry, prioridades, escalado workers horizontal
**Alternativas descartadas**: FastAPI BackgroundTasks (sin retry/persistencia), RQ (menos features), Dramatiq (menos maduro)

### ADR-002: Presidio + spaCy para PII (no LLM puro)
**Decisión**: Motor principal = Presidio Analyzer/Anonymizer + spaCy NER + recognizers custom regex
**Por qué**: 
- Detección determinista, explicable, auditable
- Latencia < 100ms/documento vs 2-5s LLM
- Coste 0 (local) vs $/token LLM
- Cumplimiento: decisión trazable a regla + entidad + score
**LLM solo como fallback**: GPT-4o-mini para validación casos ambiguos (opcional, configurable)

### ADR-003: Redacción Visual Real (PyMuPDF)
**Decisión**: `page.add_redact_annot()` + `apply_redactions(images=PDF_REDACT_IMAGE_PIXELS)`
**Por qué**: Único método que *quema* píxeles en el contenido PDF (no capa superpuesta). Certificado NIST SP 800-88. Irrecuperable por selección, copy-paste, herramientas forenses.
**Alternativas descartadas**: pdfplumber (solo extrae), reportlab (solo crea), overlay CSS (inseguro)

### ADR-004: Motor de Reglas Versionado en BD
**Decisión**: Tabla `withdrawal_rules` con versionado + snapshot `current_rule_set_version` en documento
**Por qué**: 
- Cambios en caliente sin deploy
- Auditoría: qué regla versión se aplicó a cada documento
- A/B testing de reglas
- Rollback instantáneo

### ADR-005: Máquina de Estados Explícita en BD
**Decisión**: Enum `document_status` + transiciones validadas en API + eventos Redis
**Estados**: `UPLOADED → OCR_PROCESSING → OCR_DONE → PII_DETECTING → PII_DONE → IN_REVIEW → READY_FOR_APPROVAL → APPROVED|REJECTED → EXPORTED`
**Por qué**: Trazabilidad completa, fácil añadir pasos (firma digital, notificaciones), idempotencia workers

## 4. Modelo de Datos (Resumen)

```sql
-- Tablas principales
users (id, keycloak_sub, email, role, is_active)
withdrawal_rules (id, name, entity_type, pattern_regex, action, config, version, is_active)
documents (id, filename, original_path, redacted_path, plain_text_path, status, version, assigned_to, approved_by, rule_set_version)
document_pages (id, document_id, page_num, ocr_text, ocr_confidence, source)
detected_entities (id, document_id, page_id, entity_type, start_char, end_char, bbox, confidence, rule_id, action_taken, reviewer_id, reviewed_at)
audit_log (id, document_id, user_id, action, details, created_at) -- append-only, BigSerial
```

**Vistas útiles**: `v_document_summary` (dashboard), `fn_document_can_edit()` (permisos)

## 5. Pipeline ETL (Flujo del Dato)

```
INGESTA → OCR → NLP/PII → ENRIQUECIMIENTO → WORKFLOW
  │        │      │           │              │
  ▼        ▼      ▼           ▼              ▼
Validar  300 DPI  Analyzer   Aplicar reglas  Máquina estados
MIME    Layout   Anonymizer  Versionar reglas  Eventos Redis
Guardar Words+   Custom rec. Snapshoteo       Timeouts
MinIO   bboxes   Thresholds  Marcar defaults  Reintentos
Crear BD        Multi-lang
Evento
```

**Puntos críticos**:
- **Idempotencia**: Cada paso guarda estado en BD → reintentos seguros
- **Chunking**: PDFs >50 páginas → lotes 10 páginas/worker
- **Checkpointing**: Si falla en PII, no re-hacer OCR
- **Métricas**: Latencia por etapa, throughput, error rate → Prometheus

## 6. Seguridad y Cumplimiento

| Aspecto | Implementación |
|---------|----------------|
| **Datos en reposo** | PostgreSQL TLS, MinIO SSE, discos encriptados (LUKS) |
| **Datos en tránsito** | TLS 1.3 obligatorio (ingress nginx + cert-manager) |
| **Autenticación** | Keycloak OIDC + PKCE + refresh tokens rotativos |
| **Autorización** | RBAC (transcriptor/aprobador/admin) + RLS PostgreSQL |
| **Redacción** | PyMuPDF burn (NIST 800-88); verificación post-redacción |
| **Auditoría** | Append-only `audit_log` + triggers BD + hash encadenado opcional |
| **Retención** | Configurable por tipo documento; purge job programado |
| **Backup** | pgBackRest diario + WAL continuo; restore test mensual |

## 7. Observabilidad

**Métricas KEY (Prometheus)**:
- `http_requests_total{method,endpoint,status}` - RED metrics
- `celery_task_duration_seconds{task,queue}` - Latencia workers
- `ocr_pages_per_second` - Throughput OCR
- `pii_entities_detected_total{entity_type,action}` - Calidad IA
- `document_status_gauge{status}` - WIP documents
- `db_connections_active` - Pool saturation

**Logs (Structlog JSON)**:
- `request_id` correlation across services
- Structured fields: `user_id`, `document_id`, `action`, `duration_ms`
- Log levels: DEBUG (dev), INFO (prod), WARNING/ERROR + alerting

**Dashboards Grafana**:
- Overview: Request rate, error rate, latency p95
- Workers: Queue depth, task duration, retry rate
- IA Quality: Recall/Precision por entidad, drift detection
- Business: Docs processed/day, approval rate, rejection reasons

## 8. Testing Strategy

| Nivel | Herramienta | Cobertura Objetivo |
|-------|-------------|-------------------|
| **Unit** | pytest + pytest-asyncio | > 80% backend services |
| **Integration** | pytest + testcontainers (Postgres, Redis, MinIO) | API contracts, DB migrations |
| **Contract** | Pact (consumer-driven) | Frontend-Backend API |
| **E2E** | Playwright | Critical paths: upload→review→approve→export |
| **IA Evaluation** | Custom script + gold standard dataset | Recall > 99% DNI/NIE, F1 > 97% crítico |
| **Performance** | k6 / Locust | 10 concurrent users, 50MB PDFs |
| **Security** | bandit, safety, trivy (container scan) | 0 critical/high vulns |

## 9. Despliegue y DevOps

### Entornos
| Env | Infra | Deploy |
|-----|-------|--------|
| **Local** | Docker Compose | `make up` |
| **Staging** | K8s namespace | ArgoCD auto-sync main |
| **Production** | K8s cluster | ArgoCD manual promote tag |

### CI/CD (GitHub Actions)
```yaml
stages:
  - lint: ruff, mypy, eslint
  - test: pytest (unit+integration), playwright (e2e staging)
  - build: docker multi-arch (amd64/arm64), push GHCR
  - scan: trivy, bandit, safety
  - deploy-staging: argocd sync
  - promote-prod: manual approval + tag
```

### Rollback
- Kubernetes: `argocd app rollback <app> <revision>`
- Database: `alembic downgrade -1` (migraciones reversibles obligatorias)
- Config: GitOps - revert commit

## 10. Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Falsos negativos PII** | Media | Crítico | Dataset evaluación 200+ docs; recall > 99% crítico; revisión humana obligatoria |
| **OCR baja calidad escaneados** | Media | Alto | PaddleOCR v3 + 300 DPI + preprocessing; fallback manual |
| **Keycloak indisponible** | Baja | Alto | HA Keycloak (2 réplicas); cache tokens 5min; modo degradado read-only |
| **Fuga datos (redacción falla)** | Baja | Crítico | Test post-redacción automático; verificación manual muestra; NIST certified |
| **Crecimiento BD auditoría** | Media | Medio | Particionado mensual `audit_log`; política retención 7 años; archive a cold storage |
| **Escalabilidad workers OCR** | Media | Medio | K8S HPA custom metrics (cola depth); GPU node pool opcional |

---

*Documento vivo - Actualizar en cada ADR nuevo*
