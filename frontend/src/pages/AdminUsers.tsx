import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { usersApi } from '../services/users'
import { UserInfo, UserRole } from '../types/api'
import { Card, Badge, StatusBadge, Button, Input, Modal, Table, Pagination } from '../components/ui'
import { Plus, Edit, Trash2, Search, Save, X, UserPlus, Shield, Mail } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

export function AdminUsers() {
  const { hasRole } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [roleFilter, setRoleFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null)
  const [formData, setFormData] = useState<Partial<UserInfo> & { password?: string }>({
    email: '',
    full_name: '',
    role: 'transcriptor' as UserRole,
    is_active: true,
  })

  const isAdmin = hasRole('admin')

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900">Acceso denegado</h2>
        <p className="text-slate-500 mt-2">Se requieren permisos de administrador</p>
      </div>
    )
  }

  const { data: users = [], isLoading, total } = useQuery({
    queryKey: ['users', page, pageSize, roleFilter, searchQuery],
    queryFn: () => usersApi.list({
      role: roleFilter || undefined,
      page,
      page_size: pageSize,
    }),
  })

  const totalPages = Math.ceil((total || 0) / pageSize)

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => usersApi.create(data as any),
    onSuccess: () => {
      toast.success('Usuario creado correctamente')
      closeForm()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al crear usuario')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserInfo> }) => usersApi.update(id, data),
    onSuccess: () => {
      toast.success('Usuario actualizado correctamente')
      closeForm()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar usuario')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success('Usuario desactivado')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al desactivar usuario')
    },
  })

  const openCreateForm = () => {
    setEditingUser(null)
    setFormData({
      email: '',
      full_name: '',
      role: 'transcriptor' as UserRole,
      is_active: true,
    })
    setShowForm(true)
  }

  const openEditForm = (user: UserInfo) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      is_active: user.is_active,
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingUser(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const roleLabels: Record<UserRole, string> = {
    transcriptor: 'Transcriptor',
    aprobador: 'Aprobador',
    admin: 'Administrador',
  }

  const columns = [
    {
      key: 'email',
      header: 'Email',
      render: (user: UserInfo) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-slate-400" />
          <div>
            <p className="font-medium">{user.email}</p>
            {user.full_name && <p className="text-sm text-slate-500">{user.full_name}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (user: UserInfo) => {
        const roleConfig: Record<UserRole, { variant: 'default' | 'success' | 'warning' | 'info'; icon: React.ReactNode }> = {
          transcriptor: { variant: 'default', icon: <UserPlus className="h-3 w-3 mr-1" /> },
          aprobador: { variant: 'info', icon: <Shield className="h-3 w-3 mr-1" /> },
          admin: { variant: 'warning', icon: <Shield className="h-3 w-3 mr-1" /> },
        }
        const cfg = roleConfig[user.role] || { variant: 'default', icon: null }
        return (
          <Badge variant={cfg.variant}>
            {cfg.icon}
            {roleLabels[user.role] || user.role}
          </Badge>
        )
      },
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (user: UserInfo) => user.is_active ? (
        <Badge variant="success" dot>Activo</Badge>
      ) : (
        <Badge variant="danger" dot>Inactivo</Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Creado',
      render: (user: UserInfo) => (
        <span className="text-sm text-slate-600">
          {new Date(user.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (user: UserInfo) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditForm(user)} aria-label="Editar">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(user.id)} aria-label="Desactivar" disabled={user.id === useAuth.getState().user?.sub}>
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
          <h1 className="text-2xl font-bold text-slate-900">Gestión de usuarios</h1>
          <p className="text-slate-500">Administra usuarios y roles del sistema</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      <Card variant="outlined" padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por email o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los roles</option>
            <option value="transcriptor">Transcriptor</option>
            <option value="aprobador">Aprobador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Table columns={columns} data={[]} keyExtractor={(u) => u.id} loading />
        ) : (
          <>
            <Table
              columns={columns}
              data={users}
              keyExtractor={(u) => u.id}
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
        title={editingUser ? 'Editar usuario' : 'Crear nuevo usuario'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={!!editingUser}
          />

          <Input
            label="Nombre completo"
            value={formData.full_name || ''}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rol *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="transcriptor">Transcriptor</option>
              <option value="aprobador">Aprobador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Usuario activo</label>
          </div>

          {!editingUser && (
            <Input
              label="Contraseña temporal *"
              type="password"
              value={formData.password || ''}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              helperText="El usuario deberá cambiarla en primer acceso"
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingUser ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
