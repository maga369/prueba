import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { documentsApi } from '../services/documents'
import { Document, DocumentStatus } from '../types/api'
import { Button, Card, Badge, StatusBadge, Table, Pagination, Input, Modal } from '../components/ui'
import { Plus, Search, Filter, Download, Eye, Edit, Clock, AlertCircle, CheckCircle, XCircle, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

export function Dashboard() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const isTranscriptor = hasRole('transcriptor')
  const isAprobador = hasRole('aprobador')
  const isAdmin = hasRole('admin')

  const { data: documents, isLoading, error, total } = useQuery({
    queryKey: ['documents', page, pageSize, statusFilter, searchQuery, isTranscriptor],
    queryFn: () => documentsApi.list({
      status: statusFilter || undefined,
      assigned_only: isTranscriptor,
      page,
      page_size: pageSize,
    }),
  })

  const totalPages = Math.ceil((total || 0) / pageSize)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: () => {
      toast.success('Documento subido correctamente')
      setShowUpload(false)
      setUploadFile(null)
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al subir documento')
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
    }
  }

  const handleUpload = () => {
    if (uploadFile) {
      setUploading(true)
      uploadMutation.mutate(uploadFile, {
        onSettled: () => setUploading(false),
      })
    }
  }

  const getStatusActions = (doc: Document) => {
    const actions = []

    if (doc.status === 'IN_REVIEW' && isTranscriptor) {
      actions.push(
        <Button
          key="view"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/document/${doc.id}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      )
    }

    if (doc.status === 'READY_FOR_APPROVAL' && isAprobador) {
      actions.push(
        <Button
          key="approve"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/approval/${doc.id}`)}
        >
          <CheckCircle className="h-4 w-4 text-green-600" />
        </Button>
      )
    }

    if (doc.status === 'APPROVED' || doc.status === 'EXPORTED') {
      actions.push(
        <Button
          key="download"
          variant="outline"
          size="sm"
          onClick={() => downloadDocument(doc.id, 'pdf')}
        >
          <Download className="h-4 w-4" />
        </Button>
      )
    }

    if (doc.status === 'REJECTED' && isTranscriptor) {
      actions.push(
        <Button
          key="edit"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/document/${doc.id}`)}
        >
          <Edit className="h-4 w-4" />
        </Button>
      )
    }

    return <div className="flex items-center gap-1">{actions}</div>
  }

  const downloadDocument = async (id: string, format: 'pdf' | 'txt') => {
    try {
      const blob = await documentsApi.export(id, format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${format === 'pdf' ? 'redacted' : 'clean'}_document.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast.error('Error al descargar documento')
    }
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Error al cargar documentos</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentos</h1>
          <p className="text-slate-500">Gestiona y revisa documentos para anonimización</p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Subir documento
        </Button>
      </div>

      {/* Filters */}
      <Card variant="outlined" padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los estados</option>
            <option value="UPLOADED">Subido</option>
            <option value="OCR_PROCESSING">OCR Procesando</option>
            <option value="OCR_DONE">OCR Completado</option>
            <option value="PII_DETECTING">Detectando PII</option>
            <option value="PII_DONE">PII Detectado</option>
            <option value="IN_REVIEW">En Revisión</option>
            <option value="READY_FOR_APPROVAL">Listo para Aprobar</option>
            <option value="APPROVED">Aprobado</option>
            <option value="REJECTED">Rechazado</option>
            <option value="EXPORTED">Exportado</option>
            <option value="FAILED">Error</option>
          </select>
        </div>
      </Card>

      {/* Documents Table */}
      <Card>
        {isLoading ? (
          <Table
            columns={columns}
            data={[]}
            keyExtractor={(d) => d.id}
            loading
          />
        ) : (
          <>
            <Table
              columns={columns}
              data={documents || []}
              keyExtractor={(d) => d.id}
              onRowClick={(doc) => {
                if (doc.status === 'IN_REVIEW' && isTranscriptor) {
                  navigate(`/document/${doc.id}`)
                } else if (doc.status === 'READY_FOR_APPROVAL' && isAprobador) {
                  navigate(`/approval/${doc.id}`)
                }
              }}
            />
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              totalItems={total}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>

      {/* Upload Modal */}
      <Modal
        isOpen={showUpload}
        onClose={() => { setShowUpload(false); setUploadFile(null) }}
        title="Subir nuevo documento"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Selecciona un archivo PDF o imagen para procesar. Tamaño máximo: 50MB.
          </p>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            {uploadFile ? (
              <div className="flex items-center justify-center gap-4">
                <FileText className="h-10 w-10 text-primary-600" />
                <div className="text-left">
                  <p className="font-medium">{uploadFile.name}</p>
                  <p className="text-sm text-slate-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setUploadFile(null)}>
                  Eliminar
                </Button>
              </div>
            ) : (
              <label htmlFor="file-upload" className="cursor-pointer">
                <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-slate-600">Haz clic para seleccionar o arrastra el archivo aquí</p>
                <p className="text-sm text-slate-400">PDF, PNG, JPG, TIFF (máx. 50MB)</p>
              </label>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => { setShowUpload(false); setUploadFile(null) }} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading} loading={uploading}>
              Subir y procesar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Table columns
const columns = [
  {
    key: 'original_filename',
    header: 'Documento',
    render: (doc: Document) => (
      <div>
        <p className="font-medium">{doc.original_filename}</p>
        <p className="text-sm text-slate-500">{doc.page_count} páginas · v{doc.version}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (doc: Document) => <StatusBadge status={doc.status} />,
  },
  {
    key: 'assignee',
    header: 'Asignado a',
    render: (doc: Document) => (
      <div>
        {doc.assignee_name ? (
          <>
            <p>{doc.assignee_name}</p>
            <p className="text-sm text-slate-500">{doc.assignee_email}</p>
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
    ),
  },
  {
    key: 'created_at',
    header: 'Creado',
    render: (doc: Document) => (
      <div className="text-sm">
        <p>{new Date(doc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    ),
  },
  {
    key: 'actions',
    header: 'Acciones',
    render: (doc: Document) => getStatusActions(doc),
  },
]
