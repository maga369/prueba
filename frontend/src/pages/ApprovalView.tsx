import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { documentsApi, entitiesApi } from '../services/documents'
import { DocumentDetail, Entity, EntityAction } from '../types/api'
import { Card, Badge, StatusBadge, ActionBadge, EntityTypeBadge, Button, Modal, ConfirmDialog } from '../components/ui'
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Download, Eye, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export function ApprovalView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()

  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<'pdf' | 'text'>('pdf')

  const pdfRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<any>(null)

  const isAprobador = hasRole('aprobador')
  const isAdmin = hasRole('admin')

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

  const approveMutation = useMutation({
    mutationFn: () => documentsApi.approve(id!),
    onSuccess: () => {
      toast.success('Documento aprobado correctamente')
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      navigate('/dashboard')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al aprobar')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => documentsApi.reject(id!, reason),
    onSuccess: () => {
      toast.success('Documento rechazado y devuelto al transcriptor')
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      navigate('/dashboard')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al rechazar')
    },
  })

  const handleApprove = () => {
    setShowApproveConfirm(true)
  }

  const handleReject = () => {
    setShowRejectConfirm(true)
  }

  const confirmApprove = () => {
    approveMutation.mutate()
    setShowApproveConfirm(false)
  }

  const confirmReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Debe indicar el motivo del rechazo')
      return
    }
    rejectMutation.mutate(rejectionReason)
    setShowRejectConfirm(false)
  }

  const downloadPdf = async () => {
    if (!document) return
    try {
      const blob = await documentsApi.export(id!, 'pdf')
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `redacted_${document.original_filename}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast.error('Error al descargar PDF')
    }
  }

  const downloadText = async () => {
    if (!document) return
    try {
      const blob = await documentsApi.export(id!, 'txt')
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clean_${document.original_filename.replace('.pdf', '.txt')}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast.error('Error al descargar texto')
    }
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

  if (!isAprobador && !isAdmin) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">No tienes permisos para acceder a esta vista</p>
      </div>
    )
  }

  const removedCount = entities.filter(e => e.action_taken === 'REMOVE').length
  const keptCount = entities.filter(e => e.action_taken === 'KEEP').length
  const generalizedCount = entities.filter(e => e.action_taken === 'GENERALIZE').length
  const pseudonymizedCount = entities.filter(e => e.action_taken === 'PSEUDONYMIZE').length

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <h1 className="text-lg font-semibold truncate max-w-xs">{document.original_filename}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={document.status} />
              <Badge variant="outline">v{document.version}</Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={() => setScale(Math.max(0.5, scale - 0.25))} aria-label="Alejar">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-mono text-slate-600">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={() => setScale(Math.min(3, scale + 0.25))} aria-label="Acercar">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-mono text-slate-600">{currentPage} / {document.page_count}</span>
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(document.page_count, p + 1))} disabled={currentPage === document.page_count}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={downloadPdf}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" onClick={downloadText}>
            <FileText className="h-4 w-4 mr-1" />
            Texto
          </Button>

          <Button variant="danger" onClick={handleReject} className="ml-2">
            <XCircle className="h-4 w-4 mr-1" />
            Rechazar
          </Button>
          <Button variant="primary" onClick={handleApprove}>
            <CheckCircle className="h-4 w-4 mr-1" />
            Aprobar
          </Button>
        </div>
      </div>

      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-600">Resumen:</span>
          <Badge variant="default">{document.page_count} páginas</Badge>
          <Badge variant="default">{entities.length} entidades totales</Badge>
          <ActionBadge action="REMOVE" />
          <Badge variant="danger">{removedCount}</Badge>
          <ActionBadge action="KEEP" />
          <Badge variant="success">{keptCount}</Badge>
          <ActionBadge action="GENERALIZE" />
          <Badge variant="warning">{generalizedCount}</Badge>
          <ActionBadge action="PSEUDONYMIZE" />
          <Badge variant="info">{pseudonymizedCount}</Badge>
          <span className="text-slate-500 ml-auto">Reglas v{document.current_rule_set_version || '?'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="w-1/2 lg:w-2/3 border-r border-slate-200 bg-slate-100 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h3 className="font-medium text-slate-900">PDF Redactado (Vista previa)</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            <div className="bg-white shadow-lg rounded-lg max-w-3xl w-full mx-auto">
              <canvas
                ref={pdfRef}
                className="w-full"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        </div>

        <div className="w-1/2 lg:w-1/3 bg-white flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Texto limpio</h3>
              <div className="flex gap-1">
                <Button
                  variant={activeTab === 'pdf' ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('pdf')}
                >
                  PDF
                </Button>
                <Button
                  variant={activeTab === 'text' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('text')}
                >
                  Texto
                </Button>
              </div>
            </div>
          </div>

          {activeTab === 'text' && (
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap border-slate-200">
              {document.ocr_text?.replace(
                new RegExp('\\[(REDACTED|GENERALIZED|PSEUDONYMIZED)\\]', 'g'),
                (match) => `<span class="bg-red-100 text-red-700 px-1 rounded">${match}</span>`
              ) || 'No hay texto disponible'}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={confirmApprove}
        title="Confirmar aprobación"
        message="¿Estás seguro de que quieres aprobar este documento? Se generará el PDF final redactado y el texto limpio para descarga. Esta acción es irreversible."
        confirmText="Aprobar definitivamente"
        variant="primary"
      />

      <ConfirmDialog
        isOpen={showRejectConfirm}
        onClose={() => { setShowRejectConfirm(false); setRejectionReason('') }}
        onConfirm={confirmReject}
        title="Rechazar documento"
        message="El documento será devuelto al transcriptor con tus comentarios. Debe indicar el motivo del rechazo."
        confirmText="Rechazar y devolver"
        variant="danger"
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Motivo del rechazo (obligatorio)
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Describe qué entidades faltan por revisar o qué correcciones son necesarias..."
            required
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}
