# Maquetas de Interfaz - Legal Redactor iCAT

## 1. Principios de Diseno

- **Claridad ante todo**: El usuario debe distinguir instantly que esta pendiente vs revisado
- **Eficiencia teclado**: 100% operable sin raton (atajos J/K, R/M/G/K/S)
- **Accesibilidad**: WCAG 2.1 AA, contraste, foco visible, screen readers
- **Responsive**: Desktop-first (uso real), tablet funcional, movil solo consulta

## 2. Pantallas Principales

### 2.1. Login (Keycloak)

Pantalla centrada con logo iCAT, titulo "Legal Redactor v1.0", boton "Iniciar sesion con Keycloak", enlace ayuda.

### 2.2. Dashboard (Lista de Documentos)

Tabla con columnas: Documento, Paginas, Estado, Asignado, Acciones.

Filtros: Buscar por nombre, Estado (dropdown), Solo mios (checkbox).

Estados con colores:
- Verde: OCR_DONE, PII_DONE, APPROVED, EXPORTED
- Amarillo: OCR_PROCESSING, PII_DETECTING, IN_REVIEW, READY_FOR_APPROVAL
- Rojo: REJECTED, FAILED
- Azul: UPLOADED

Paginacion inferior con selector de tamano de pagina.

### 2.3. Subida de Documento (Modal)

Dropzone con texto "Haz clic para seleccionar o arrastra el archivo aqui".
Formatos: PDF, PNG, JPG, TIFF (max 50MB).
Botones: Cancelar / Subir y procesar.

### 2.4. Vista Revision (Transcriptor) - Pantalla Principal

Layout de 3 columnas:

**Columna Izquierda (Entidades)**:
- Barra busqueda + filtros por tipo (checkboxes)
- Lista entidades con: tipo, confianza, pagina, estado (rojo/amarillo/verde)
- Click en fila -> selecciona y navega PDF

**Columna Central (Visor PDF)**:
- PDF original con overlays Canvas
- Cajas rojas = pendientes, verdes = revisadas, amarillo = seleccionada
- Controles: zoom, navegacion paginas, minimapa lateral
- Sync bidireccional con tabla

**Columna Derecha (Acciones)**:
- Detalle entidad seleccionada: tipo, texto, bbox
- Botones accion: Retirar / Generalizar / Pseudonimizar / Mantener
- Campo comentario
- Boton "Listo para aprobacion" (habilitado solo si 0 pendientes)

Atajos teclado: J/K navegar, R retirar, M mantener, G generalizar, P pseudonimizar, S guardar.

### 2.5. Vista Aprobacion (Aprobador)

Layout 2 paneles:

**Panel Izquierdo (PDF Redactado Preview)**:
- PDF con cajas negras quemadas
- Controles zoom, navegacion paginas

**Panel Derecho (Texto Limpio Preview)**:
- Texto con placeholders [NOMBRE], [DNI], [MEDICAMENTO]
- Botones Copiar / Descargar .txt

Barra inferior: Comentario (obligatorio si rechaza) + botones Rechazar / Aprobar.

Resumen superior: paginas, entidades totales, conteo por accion, version reglas.

### 2.6. Admin - Gestion de Reglas

Tabla: Nombre, Entidad, Patron, Accion, Activa, Version.
Filtros: busqueda, tipo entidad.
Boton "Nueva regla" abre modal.
Edicion duplica version (v3->v4) para cambios seguros.

### 2.7. Modal Formulario Regla

Campos: Nombre*, Tipo entidad*, Accion*, Activa (checkbox), Patron Regex (opcional), Descripcion.
Helper text: "Dejar vacio para usar detector built-in de Presidio".

## 3. Componentes UI Reutilizables

### Badges de Estado
UPLOADED, OCR_PROCESSING, OCR_DONE, PII_DETECTING, PII_DONE, IN_REVIEW, READY_FOR_APPROVAL, APPROVED, REJECTED, EXPORTED, FAILED

### Badges de Accion
RETIRAR, GENERALIZAR, PSEUDONIMIZAR, MANTENER, EDITADO

### Badges de Tipo Entidad
PERSON, LOCATION, PHONE, EMAIL, ES_NIF, ES_NIE, ES_CIF, CAT_CIP, IBAN, DATE, ICD10, EXPEDIENTE, COLEGIADO

## 4. Atajos de Teclado (Vista Revision)

| Tecla | Accion |
|-------|--------|
| J / Flecha abajo | Entidad siguiente |
| K / Flecha arriba | Entidad anterior |
| R | Marcar Retirar |
| M | Marcar Mantener |
| G | Marcar Generalizar |
| P | Marcar Pseudonimizar |
| E | Editar texto reemplazo |
| S | Guardar cambios |
| Enter | Enviar para aprobacion (si 0 pendientes) |
| Esc | Cerrar modal / deseleccionar |

## 5. Responsive Breakpoints

| Breakpoint | Ancho | Comportamiento |
|------------|-------|----------------|
| Desktop | >= 1024px | Vista completa 3 columnas |
| Tablet | 768-1023px | Sidebar colapsable; visor + panel apilados |
| Movil | < 768px | Solo dashboard y aprobacion; revision solo lectura |

## 6. Estados de Carga y Error

Skeleton loading en tablas durante fetch.
Toasts top-right para acciones (auto-dismiss 4s).
Errores inline en formularios.
Paginas completas 404/500/403 con boton reintentar.

## 7. Accesibilidad Checklist

- Contraste >= 4.5:1
- Foco visible (outline 2px solid #0ea5e9)
- Navegacion teclado completa
- ARIA labels en botones solo-icono
- role="dialog" + aria-modal="true" en modales
- aria-live="polite" en toasts
- Zoom 200% sin perdida funcionalidad
- Test NVDA/VoiceOver

---

Maquetas en Figma: [enlace] | Exportadas para desarrollo en docs/03-ui-mockups/
