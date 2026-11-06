import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { rulesApi } from '../services/rules'
import { Rule, RuleCreate, RuleUpdate, EntityAction } from '../types/api'
import { Card, Badge, ActionBadge, EntityTypeBadge, Button, Input, Modal, Table, Pagination } from '../components/ui'
import { Plus, Edit, Trash2, Search, Save, X } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

export function AdminRules() {
  const { hasRole } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [formData, setFormData] = useState<RuleCreate>({
    name: '',
    description: '',
    entity_type: '',
    pattern_regex: '',
    action: 'REMOVE',
    config: {},
    is_active: true,
  })
  const [entityTypes, setEntityTypes] = useState<string[]>([])

  const isAdmin = hasRole('admin')

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900">Acceso denegado</h2>
        <p className="text-slate-500 mt-2">Se requieren permisos de administrador</p>
      </div>
    )
  }

  const { data: rules = [], isLoading, total } = useQuery({
    queryKey: ['rules', page, pageSize, entityTypeFilter, searchQuery],
    queryFn: () => rulesApi.list({
      entity_type: entityTypeFilter || undefined,
      page,
      page_size: pageSize,
    }),
  })

  const totalPages = Math.ceil((total || 0) / pageSize)

  useEffect(() => {
    rulesApi.getEntityTypes().then(setEntityTypes).catch(console.error)
  }, [])

  const createMutation = useMutation({
    mutationFn: (rule: RuleCreate) => rulesApi.create(rule),
    onSuccess: () => {
      toast.success('Regla creada correctamente')
      closeForm()
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al crear regla')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RuleUpdate }) => rulesApi.update(id, data),
    onSuccess: () => {
      toast.success('Regla actualizada correctamente')
      closeForm()
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar regla')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rulesApi.delete(id),
    onSuccess: () => {
      toast.success('Regla eliminada/desactivada')
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar regla')
    },
  })

  const openCreateForm = () => {
    setEditingRule(null)
    setFormData({
      name: '',
      description: '',
      entity_type: '',
      pattern_regex: '',
      action: 'REMOVE',
      config: {},
      is_active: true,
    })
    setShowForm(true)
  }

  const openEditForm = (rule: Rule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      description: rule.description || '',
      entity_type: rule.entity_type,
      pattern_regex: rule.pattern_regex || '',
      action: rule.action,
      config: rule.config,
      is_active: rule.is_active,
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingRule(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (rule: any) => (
        <div>
          <p className="font-medium">{rule.name}</p>
          {rule.description && <p className="text-sm text-slate-500 truncate max-w-xs">{rule.description}</p>}
        </div>
      ),
    },
    {
      key: 'entity_type',
      header: 'Tipo entidad',
      render: (rule: any) => <EntityTypeBadge type={rule.entity_type} />,
    },
    {
      key: 'pattern_regex',
      header: 'Patrón regex',
      render: (rule: any) => rule.pattern_regex ? (
        <code className="text-sm bg-slate-100 px-2 py-1 rounded font-mono">{rule.pattern_regex}</code>
      ) : (
        <span className="text-slate-400 text-sm">(builtin)</span>
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (rule: any) => <ActionBadge action={rule.action} />,
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (rule: any) => rule.is_active ? (
        <Badge variant="success" dot>Activa</Badge>
      ) : (
        <Badge variant="danger" dot>Inactiva</Badge>
      ),
    },
    {
      key: 'version',
      header: 'Versión',
      render: (rule: any) => <span className="font-mono">v{rule.version}</span>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (rule: any) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditForm(rule)} aria-label="Editar">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(rule.id)} aria-label="Eliminar">
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reglas de retirada</h1>
          <p className="text-slate-500">Configura qué entidades detectar y cómo tratarlas</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva regla
        </Button>
      </div>

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
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los tipos</option>
            {entityTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Table columns={columns} data={[]} keyExtractor={(r) => r.id} loading />
        ) : (
          <>
            <Table
              columns={columns}
              data={rules}
              keyExtractor={(r) => r.id}
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

      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingRule ? 'Editar regla' : 'Crear nueva regla'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <select
              value={formData.entity_type}
              onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar tipo de entidad</option>
              {entityTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={formData.action}
              onChange={(e) => setFormData({ ...formData, action: e.target.value as EntityAction })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="REMOVE">Retirar (tachar)</option>
              <option value="GENERALIZE">Generalizar</option>
              <option value="PSEUDONYMIZE">Pseudonimizar</option>
              <option value="KEEP">Mantener</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Activa</label>
            </div>
          </div>

          <Input
            label="Patrón Regex (opcional)"
            value={formData.pattern_regex}
            onChange={(e) => setFormData({ ...formData, pattern_regex: e.target.value })}
            placeholder="Ej: ^[0-9]{8}[A-Z]$"
            helperText="Dejar vacío para usar el detector built-in de Presidio"
          />

          <Input
            label="Descripción"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Descripción de la regla..."
            multiline
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingRule ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
