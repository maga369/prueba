import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { documentsApi, entitiesApi } from '../services/documents'
import { DocumentDetail, Entity, EntityAction, EntityUpdate, EntityStats } from '../types/api'
import { Card, Badge, StatusBadge, ActionBadge, EntityTypeBadge, Button, Modal, ConfirmDialog } from '../components/ui'
import { ArrowLeft, Save, CheckCircle, XCircle, AlertCircle, FileText, Download, RotateCcw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export function DocumentView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()

  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [entityStats, setEntityStats] = useState<EntityStats | null>(null)

  const pdfOriginalRef = useRef<HTMLCanvasElement>(null)
  const pdfRedactedRef = useRef<HTMLCanvasElement>(null)
  const originalPdfRef = useRef<any>(null)
  const redactedPdfRef = useRef<any>(null)

  const isTranscriptor = hasRole('transcriptor')

  const { data: document, isLoading, error } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id!),
    enabled: !!id,
  })

  const { data: entities = [] } = useQuery({
    queryKey: ['entities', id],
    queryFn: () => entitiesApi.getByDocument(id!),
    enabled: !!id,
  })

  // Load entity stats
  useEffect(() => {
    if (id) {
      entitiesApi.getStats(id).then(setEntityStats).catch(console.error)
    }
  }, [id])

  // Load PDFs when document changes
  useEffect(() => {
    if (document?.original_path) {
      loadPdf(document.original_path, 'original')
    }
    if (document?.redacted_path) {
      loadPdf(document.redacted_path, 'redacted')
    }
  }, [document])

  const loadPdf = async (path: string, type: 'original' | 'redacted') => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/documents/${id}/export?format=pdf`, {
        headers: { Authorization: `Bearer ${useAuth.getState().keycloak?.token}` },
      })
      // For demo, we'll use a different approach - load via proxy
      // In production, you'd use the actual PDF URL
    } catch (error) {
      console.error('Failed to load PDF:', error)
    }
  }

  const renderPage = async (pdf: any, pageNum: number, canvasRef: React.RefObject<HTMLCanvasElement>) => {
    if (!pdf || !canvasRef.current) return
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: context, viewport }).promise

    // Draw entity highlights on original
    if (type === 'original' && pdf === originalPdfRef.current) {
      drawEntityHighlights(page, viewport, context)
    }
  }

  const drawEntityHighlights = (page: any, viewport: any, context: CanvasRenderingContext2D) => {
    const pageEntities = entities.filter(e => e.page_num === currentPage)
    pageEntities.forEach(entity => {
      const [x0, y0, x1, y1] = entity.bbox
      const width = x1 - x0
      const height = y1 - y0

      // Convert PDF points to canvas coordinates
      const scaleX = viewport.width / page.viewport.width
      const scaleY = viewport.height / page.viewport.height

      context.strokeStyle = entity.reviewed_at ? '#22c55e' : '#ef4444'
      context.lineWidth = 2
      context.setLineDash([5, 5])
      context.strokeRect(x0 * scaleX, y0 * scaleY, width * scaleX, height * scaleY)
      context.setLineDash([])

      // Label
      context.fillStyle = entity.reviewed_at ? '#22c55e' : '#ef4444'
      context.font = '12px sans-serif'
      context.fillText(entity.entity_type, x0 * scaleX, (y0 - 4) * scaleY)
    })
  }

  const updateEntityMutation = useMutation({
    mutationFn: ({ entityId, update }: { entityId: string; update: EntityUpdate }) =>
      entitiesApi.update(entityId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', id] })
      queryClient.invalidateQueries({ queryKey: ['document', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar entidad')
    },
  })

  const handleEntityAction = (entity: Entity, action: EntityAction) => {
    updateEntityMutation.mutate({
      entityId: entity.id,
      update: { action_taken: action, reviewed_at: new Date().toISOString() },
    })
  }

  const handleSubmitReview = () => {
    documentsApi.submitReview(id!).then(() => {
      toast.success('Documento enviado para aprobación')
      queryClient.invalidateQueries({ queryKey: ['document', id] })
      navigate('/dashboard')
    }).catch((error: any) => {
      toast.error(error.response?.data?.detail || 'Error al enviar para revisión')
    })
  }

  const handleSaveChanges = () => {
    // Save any pending changes
    toast.success('Cambios guardados')
  }

  if (isLoading || !document) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Error al cargar el documento</p>
      </div>
    )
  }

  // Filter entities for current page
  const pageEntities = entities.filter(e => e.page_num === currentPage)
  const pendingCount = entities.filter(e => !e.reviewed_at).length

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold truncate max-w-xs">{document.original_filename}</h1>
            <StatusBadge status={document.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={() => setScale(Math.max(0.5, scale - 0.25))} aria-label="Alejar">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-mono text-slate-600">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={() => setScale(Math.min(3, scale + 0.25))} aria-label="Acercar">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-mono text-slate-600">
              {currentPage} / {document.page_count}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(document.page_count, p + 1))} disabled={currentPage === document.page_count}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions */}
          {document.status === 'IN_REVIEW' && isTranscriptor && (
            <>
              <Button variant="secondary" onClick={handleSaveChanges}>
                <Save className="h-4 w-4 mr-1" />
                Guardar
              </Button>
              {pendingCount === 0 && (
                <Button variant="primary" onClick={() => setShowSubmitConfirm(true)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Enviar para aprobación
                </Button>
              )}
              {pendingCount > 0 && (
                <Badge variant="warning" className="ml-2">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {pendingCount} pendientes
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left panel - Entities list */}
        <div className="w-80 lg:w-96 border-r border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
          {/* Stats header */}
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-medium text-slate-900 mb-3">Entidades detectadas</h3>
            {entityStats && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white p-2 rounded-lg">
                  <p className="text-slate-500">Total</p>
                  <p className="font-bold">{entityStats.total}</p>
                </div>
                <div className="bg-white p-2 rounded-lg">
                  <p className="text-slate-500">Revisadas</p>
                  <p className="font-bold text-green-600">{entityStats.reviewed}</p>
                </div>
                <div className="bg-white p-2 rounded-lg">
                  <p className="text-slate-500">Pendientes</p>
                  <p className="font-bold text-red-600">{entityStats.pending_review}</p>
                </div>
                <div className="bg-white p-2 rounded-lg">
                  <p className="text-slate-500">En página</p>
                  <p className="font-bold">{pageEntities.length}</p>
                </div>
              </div>
            )}
          </div>

          {/* Entity list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {entities.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No se detectaron entidades</p>
            ) : (
              entities.map((entity) => (
                <EntityRow
                  key={entity.id}
                  entity={entity}
                  isCurrentPage={entity.page_num === currentPage}
                  isSelected={selectedEntityId === entity.id}
                  onSelect={() => {
                    setSelectedEntityId(entity.id)
                    if (entity.page_num !== currentPage) {
                      setCurrentPage(entity.page_num)
                    }
                  }}
                  onAction={handleEntityAction}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel - PDF Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
            <div className="bg-white shadow-lg rounded-lg max-w-4xl w-full mx-auto">
              <canvas
                ref={pdfOriginalRef}
                className="w-full"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submit confirmation modal */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleSubmitReview}
        title="Enviar para aprobación"
        message="¿Estás seguro de que quieres enviar este documento para aprobación? Una vez enviado, no podrás modificar las entidades hasta que sea aprobado o rechazado."
        confirmText="Enviar para aprobación"
        variant="primary"
      />
    </div>
  )
}

// Entity row component
function EntityRow({
  entity,
  isCurrentPage,
  isSelected,
  onSelect,
  onAction,
}: {
  entity: Entity
  isCurrentPage: boolean
  isSelected: boolean
  onSelect: () => void
  onAction: (entity: Entity, action: EntityAction) => void
}) {
  const isReviewed = !!entity.reviewed_at

  return (
    <div
      className={clsx(
        'p-3 rounded-lg border transition-all cursor-pointer',
        isSelected ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300',
        !isCurrentPage && 'opacity-60'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <EntityTypeBadge type={entity.entity_type} />
            <ActionBadge action={entity.action_taken} />
            {isReviewed && (
              <Badge variant="success" size="sm" dot>
                Revisado
              </Badge>
            )}
            {!isReviewed && (
              <Badge variant="warning" size="sm" dot>
                Pendiente
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm font-mono text-slate-700 truncate">
            "{entity.original_text?.substring(0, 50)}{entity.original_text && entity.original_text.length > 50 ? '...' : ''}"
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Página {entity.page_num} · Confianza: {Math.round(entity.confidence * 100)}%
          </p>
        </div>
      </div>

      {!isReviewed && (
        <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-100">
          {[
            { action: 'REMOVE' as EntityAction, label: 'Retirar', variant: 'danger' as const },
            { action: 'GENERALIZE' as EntityAction, label: 'Generalizar', variant: 'warning' as const },
            { action: 'PSEUDONYMIZE' as EntityAction, label: 'Pseudonimizar', variant: 'info' as const },
            { action: 'KEEP' as EntityAction, label: 'Mantener', variant: 'success' as const },
          ].map(({ action, label, variant }) => (
            <Button
              key={action}
              variant={variant}
              size="sm"
              className="flex-1 min-w-[70px]"
              onClick={(e) => {
                e.stopPropagation()
                onAction(entity, action)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
