# Plan de Pruebas - Legal Redactor iCAT

## 1. Estrategia General

| Nivel | Herramienta | Cobertura Objetivo | Ejecucion |
|-------|-------------|-------------------|-----------|
| **Unit** | pytest + pytest-asyncio | > 80% backend services | CI cada PR |
| **Integration** | pytest + testcontainers | API contracts, DB migrations | CI cada PR |
| **Contract** | Pact (consumer-driven) | Frontend-Backend API | CI cada PR |
| **E2E** | Playwright | Critical paths | CI nightly + pre-release |
| **IA Evaluation** | Custom script + gold standard | Recall > 99% critico | Sprint review |
| **Performance** | k6 | 10 concurrent users | Release candidate |
| **Security** | bandit, safety, trivy | 0 critical/high | CI cada build |

## 2. Casos de Prueba Funcionales (Prioridad Alta)

### 2.1. Subida y Procesamiento
| ID | Caso | Pasos | Resultado Esperado |
|----|------|-------|------------------|
| **TC-001** | Subir PDF nativo valido | 1. Login transcriptor 2. Drag & drop PDF nativo 3. Ver dashboard | Documento en estado OCR_PROCESSING -> OCR_DONE -> PII_DONE -> IN_REVIEW |
| **TC-002** | Subir PDF escaneado | 1. Login 2. Subir scan 300 DPI 3. Esperar procesamiento | OCR extrae texto; entidades detectadas con bboxes |
| **TC-003** | Subir imagen JPG | 1. Login 2. Subir JPG 3. Ver resultado | OCR funciona; entidades en pagina 1 |
| **TC-004** | Archivo muy grande (>50MB) | 1. Intentar subir 60MB | Error 413 "File too large" |
| **TC-005** | Formato no permitido (.exe) | 1. Intentar subir .exe | Error 400 "File type not allowed" |
| **TC-006** | PDF nativo vs escaneado detection | 1. Subir ambos tipos 2. Ver source en pages | source = "native" o "ocr" correcto |

### 2.2. Revision de Entidades (Transcriptor)
| ID | Caso | Pasos | Resultado Esperado |
|----|------|-------|------------------|
| **TC-010** | Navegar entidades teclado | 1. Abrir doc IN_REVIEW 2. J/K | Seleccion mueve fila + scroll PDF sincronizado |
| **TC-011** | Marcar Retirar | 1. Seleccionar entidad PERSON 2. Tecla R | action_taken = REMOVE; badge verde; revisado_at set |
| **TC-012** | Marcar Mantener (diagnostico) | 1. Seleccionar ICD10 2. Tecla M | action_taken = KEEP; no se tacha en PDF final |
| **TC-013** | Marcar Generalizar (fecha) | 1. Seleccionar DATE 2. Tecla G | action_taken = GENERALIZE; replacement_text = año |
| **TC-014** | Marcar Pseudonimizar (medico) | 1. Seleccionar PERSON con "Dr." 2. Tecla P | action_taken = PSEUDONYMIZE; prefix "Dr. " |
| **TC-014** | Editar texto reemplazo | 1. Seleccionar entidad 2. Tecla E 3. Escribir "PACIENTE_X" | replacement_text actualizado |
| **TC-015** | Sync bidireccional PDF-tabla | 1. Click bbox PDF 2. Click fila tabla | Seleccion sincronizada en ambas direcciones |
| **TC-016** | Guardar cambios | 1. Modificar varias entidades 2. Tecla S | Toast "Cambios guardados"; BD actualizada |
| **TC-017** | Enviar aprobacion con pendientes | 1. Dejar 1 entidad sin revisar 2. Boton enviar | Error "Todas las entidades deben ser revisadas" |
| **TC-018** | Enviar aprobacion OK | 1. Revisar todas 2. Boton enviar | Estado = READY_FOR_APPROVAL; notificacion aprobador |

### 2.3. Aprobacion (Aprobador)
| ID | Caso | Pasos | Resultado Esperado |
|----|------|-------|------------------|
| **TC-020** | Ver preview PDF redactado | 1. Login aprobador 2. Abrir READY_FOR_APPROVAL | PDF con cajas negras; texto limpio visible |
| **TC-021** | Aprobar documento | 1. Click Aprobar 2. Confirmar | Estado = APPROVED; redacted_path + plain_text_path generados; queue export |
| **TC-022** | Rechazar con comentario | 1. Click Rechazar 2. Escribir motivo 3. Confirmar | Estado = REJECTED; assigned_to = transcriptor original; notificacion |
| **TC-023** | Rechazar sin comentario | 1. Click Rechazar 2. Confirmar sin texto | Error "Motivo obligatorio" |
| **TC-024** | Descargar PDF redactado | 1. Aprobar 2. Boton Descargar PDF | Archivo .pdf descargado; buscar DNI = 0 resultados |
| **TC-025** | Descargar texto limpio | 1. Aprobar 2. Boton Descargar TXT | Archivo .txt con placeholders [NOMBRE], [DNI] |

### 2.4. Admin - Reglas y Usuarios
| ID | Caso | Pasos | Resultado Esperado |
|----|------|-------|------------------|
| **TC-030** | Crear regla custom DNI | 1. Admin -> Reglas -> Nueva 2. Rellenar 3. Guardar | Regla aparece en lista; version=1; activa |
| **TC-031** | Editar regla (nueva version) | 1. Editar regla 2. Cambiar accion 3. Guardar | Version incrementa (v1->v2); documento usa snapshot |
| **TC-032** | Desactivar regla en uso | 1. Desactivar regla con entidades asignadas | Soft delete (is_active=false); no hard delete |
| **TC-033** | Crear usuario transcriptor | 1. Admin -> Usuarios -> Nuevo 2. Rellenar | Usuario creado; rol=transcriptor; activo |
| **TC-034** | Cambiar rol usuario | 1. Editar usuario 2. Cambiar rol a aprobador | Rol actualizado; permisos efectivos inmediato |

### 2.5. Auditoría y Trazabilidad
| ID | Caso | Verificacion |
|----|------|--------------|
| **TC-040** | Log subida documento | audit_log: action=UPLOAD, user_id, document_id, timestamp |
| **TC-041** | Log revision entidad | audit_log: action=ENTITY_REVIEWED, details={entity_id, action_before, action_after} |
| **TC-042** | Log aprobacion | audit_log: action=APPROVED, user_id=aprobador, document_id |
| **TC-043** | Log rechazo | audit_log: action=REJECTED, details={rejection_reason} |
| **TC-044** | Log exportacion | audit_log: action=EXPORTED, format=pdf/txt |
| **TC-045** | Inmutabilidad log | Intento DELETE/UPDATE audit_log -> Error BD |

## 3. Pruebas de IA / Calidad PII

### 3.1. Dataset Gold Standard
- **200 documentos iCAT** anotados manualmente (2 transcriptores + 1 aprobador consenso)
- **Tipos**: 50 informes clinicos, 50 consentimientos, 50 altas, 30 urgencias, 20 admin
- **Entidades anotadas**: ~15,000 entidades (DNI, NIE, nombres, telefonos, emails, CIE-10, fechas, CIP, expedientes)

### 3.2. Metricas Objetivo

| Entidad | Recall Objetivo | Precision Objetivo | F1 Objetivo |
|---------|----------------|-------------------|-------------|
| **ES_NIF (DNI)** | > 99% | > 98% | > 98.5% |
| **ES_NIE** | > 99% | > 98% | > 98.5% |
| **ES_CIF** | > 98% | > 97% | > 97.5% |
| **CAT_CIP** | > 95% | > 95% | > 95% |
| **PERSON** | > 95% | > 94% | > 94.5% |
| **PHONE_NUMBER** | > 97% | > 96% | > 96.5% |
| **EMAIL_ADDRESS** | > 99% | > 99% | > 99% |
| **ICD10** | > 90% | > 95% | > 92% |
| **GLOBAL (critico)** | > 99% | > 95% | > 97% |

### 3.3. Script Evaluacion

```bash
# Ejecutar evaluacion completa
make eval-pii

# Output esperado:
# ========================
# PII Evaluation Results
# ========================
# Entity         Precision  Recall    F1       Support
# ES_NIF         0.987      0.992     0.989    1,247
# ES_NIE         0.981      0.995     0.988      312
# PERSON         0.943      0.956     0.949    4,521
# ...
# OVERALL        0.962      0.971     0.966   15,234
# ========================
# CRITICAL RECALL (DNI+NIE+CIF+PERSON+PHONE+EMAIL): 0.991 ✓
# ========================
```

### 3.4. Casos Edge a Testear
- Nombres compuestos: "Maria del Carmen", "Juan Carlos"
- Formato catalan: "Maria José", "Joan Carles"
- Abreviaturas medicas: "Dr. Garcia", "Dra. Lopez"
- Fechas ambiguas: "12/03/2024" vs "12/03" (hora/dosis)
- Direcciones completas: "C/ Mayor 12, 3º 2ª"
- CIP con ceros iniciales: "0001234567"

## 4. Pruebas de Rendimiento

| Test | Herramienta | Criterio Aceptacion |
|------|-------------|-------------------|
| **Carga API** | k6 | 100 VU, 5 min, p95 < 500ms |
| **OCR Throughput** | Script custom | 30 paginas/min (CPU) / 120 paginas/min (GPU) |
| **PII Detection** | Benchmark interno | < 100ms/documento (10 paginas) |
| **Redaccion PDF** | Benchmark interno | < 5s (50 paginas) |
| **Descarga PDF** | k6 | 50MB, p95 < 10s |
| **Concurrencia** | k6 | 10 usuarios simultaneos sin errores |
| **Memoria Workers** | Monitoring | < 2GB/worker OCR; < 500MB PII |

## 5. Pruebas de Seguridad

| Test | Herramienta | Criterio |
|------|-------------|----------|
| **SAST** | bandit + semgrep | 0 high/critical |
| **Dependencias** | safety + pip-audit | 0 vulnerabilidades conocidas |
| **Container Scan** | trivy | 0 critical/high en imagen final |
| **Penetration Test** | OWASP ZAP (automatizado) | 0 high/medium en endpoints auth |
| **Redaccion Verificacion** | Script custom | 0 matches DNI/NIE/telefono en PDF redactado |
| **Auth Bypass** | Manual + automatizado | 403 en endpoints sin token; 401 token expirado |
| **RBAC** | Matrix testing | Transcriptor no ve admin; aprobador no edita en IN_REVIEW |

## 6. Pruebas de Accesibilidad

| Test | Herramienta | Criterio |
|------|-------------|----------|
| **Contraste** | axe-core | 0 violaciones AA |
| **Teclado** | Tab navigation manual | 100% operable |
| **Screen Reader** | NVDA + VoiceOver | Lectura correcta labels, estados |
| **Zoom 200%** | Browser zoom | Sin loss funcionalidad |
| **ARIA** | axe-core + manual | 0 errores criticos |

## 7. Matriz de Trazabilidad Requisitos-Tests

| Requisito (Spec) | Tests Cubriendo |
|------------------|-----------------|
| F-01: OCR + deteccion >=95% | TC-001, TC-002, TC-006, IA Evaluation |
| F-02: Correccion texto + historial | TC-011 a TC-015 |
| F-03: Marcar Mantener diagnostico | TC-012 |
| F-04: Aprobacion genera PDF + texto | TC-021, TC-024, TC-025 |
| F-05: Rechazo con comentario | TC-022, TC-023 |
| F-06: Edicion aprobado = nueva version | TC-025 (verificacion versionado) |
| F-07: PDF redactado irrecuperable | Security: Redaccion Verificacion |
| F-08: Auditoría completa | TC-040 a TC-045 |

## 8. Entornos de Prueba

| Entorno | Uso | Datos |
|---------|-----|-------|
| **Local (dev)** | Unit, Integration | Synthetic fixtures, factories |
| **CI (GitHub Actions)** | Unit, Integration, Contract, Security | Testcontainers (PG, Redis, MinIO) |
| **Staging** | E2E, Performance, Accessibility, IA Eval | Subset gold standard (50 docs) |
| **Pre-Prod** | UAT, Penetration, Load | Copia anonimizada produccion (si existe) |

## 9. Criterios de Salida (Definition of Done por Sprint)

| Criterio | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
|----------|----------|----------|----------|----------|
| Unit tests pass | ✓ | ✓ | ✓ | ✓ |
| Integration tests pass | ✓ | ✓ | ✓ | ✓ |
| E2E critical paths | - | ✓ | ✓ | ✓ |
| IA Recall critico > 95% | - | >90% | >95% | >99% |
| Performance baseline | - | - | ✓ | ✓ |
| Security scan clean | ✓ | ✓ | ✓ | ✓ |
| Accessibility AA | - | - | ✓ | ✓ |
| Documentacion actualizada | ✓ | ✓ | ✓ | ✓ |

## 10. Herramientas y Comandos

```bash
# Tests unitarios + integracion
make test

# Tests E2E (requiere staging)
make test-e2e

# Evaluacion IA
make eval-pii

# Performance (k6)
make perf-test

# Security scan
make security-scan

# Accessibility
make a11y-test

# Todo (CI pipeline)
make ci
```

---

*Plan vivo - Actualizar cada sprint con nuevos casos y metricas*
