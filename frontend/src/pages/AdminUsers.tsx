import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { usersApi } from "../services/users";
import { UserInfo, UserRole } from "../types/api";
import { Button, Card, Table, Pagination, Input, Modal, Badge } from "../components/ui";
import { Plus, Edit, Trash2, Search, User, Shield, Save, X } from "lucide-react";
import toast from "react-hot-toast";

export function AdminUsers() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [formData, setFormData] = useState<Partial<UserInfo> & { password?: string }>({
    email: "",
    full_name: "",
    role: "transcriptor",
    is_active: true,
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = hasRole("admin");

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users", page, pageSize, searchQuery],
    queryFn: () => usersApi.list({ page, page_size: pageSize, search: searchQuery || undefined }),
  });

  const total = users?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const items = users?.items || [];

  const createMutation = useMutation({
    mutationFn: (data: Partial<UserInfo> & { password: string }) => usersApi.create(data),
    onSuccess: () => { toast.success("Usuario creado"); setShowModal(false); resetForm(); queryClient.invalidateQueries({ queryKey: ["users"] }); },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al crear"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserInfo> }) => usersApi.update(id, data),
    onSuccess: () => { toast.success("Usuario actualizado"); setShowModal(false); setEditingUser(null); resetForm(); queryClient.invalidateQueries({ queryKey: ["users"] }); },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { toast.success("Usuario eliminado"); queryClient.invalidateQueries({ queryKey: ["users"] }); },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al eliminar"),
  });

  const resetForm = () => { setFormData({ email: "", full_name: "", role: "transcriptor", is_active: true, password: "" }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData }, { onSettled: () => setSubmitting(false) });
    } else {
      createMutation.mutate(formData as any, { onSettled: () => setSubmitting(false) });
    }
  };

  const handleEdit = (user: UserInfo) => {
    setEditingUser(user);
    setFormData({ email: user.email, full_name: user.full_name || "", role: user.role, is_active: user.is_active, password: "" });
    setShowModal(true);
  };

  const handleDelete = (id: string) => { if (window.confirm("¿Eliminar este usuario?")) deleteMutation.mutate(id); };

  const columns = [
    { key: "email", header: "Email", render: (u: UserInfo) => <span className="font-medium">{u.email}</span> },
    { key: "full_name", header: "Nombre", render: (u: UserInfo) => <span>{u.full_name || "—"}</span> },
    { key: "role", header: "Rol", render: (u: UserInfo) => <Badge variant={u.role === "admin" ? "secondary" : "default"}>{u.role}</Badge> },
    { key: "is_active", header: "Activo", render: (u: UserInfo) => (u.is_active ? <span className="text-green-600">Sí</span> : <span className="text-red-600">No</span>) },
    { key: "created_at", header: "Creado", render: (u: UserInfo) => <span className="text-sm">{new Date(u.created_at).toLocaleDateString()}</span> },
    { key: "actions", header: "Acciones", render: (u: UserInfo) => isAdmin ? <div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => handleEdit(u)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button></div> : null },
  ];

  if (error) return <div className="text-center py-12 text-red-600">Error al cargar usuarios</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Gestión de usuarios</h1><p className="text-slate-500">Administra usuarios y roles del sistema</p></div>
        {isAdmin && <Button onClick={() => { resetForm(); setEditingUser(null); setShowModal(true); }}><Plus className="h-4 w-4 mr-2" />Nuevo usuario</Button>}
      </div>
      <Card variant="outlined" padding="md"><Input placeholder="Buscar usuarios..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" /></Card>
      <Card>{isLoading ? <Table columns={columns} data={[]} keyExtractor={(u) => u.id} loading /> : <> <Table columns={columns} data={items} keyExtractor={(u) => u.id} /><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} totalItems={total} onPageSizeChange={setPageSize} /></>}</Card>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingUser(null); resetForm(); }} title={editingUser ? "Editar usuario" : "Nuevo usuario"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="block text-sm font-medium mb-1">Email *</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></div>
            <div><label className="block text-sm font-medium mb-1">Nombre completo</label><Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} /></div>
            <div><label className="block text-sm font-medium mb-1">Rol *</label><select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })} className="w-full px-3 py-2 border border-slate-300 rounded-lg"><option value="transcriptor">Transcriptor</option><option value="aprobador">Aprobador</option><option value="admin">Administrador</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Estado</label><select value={String(formData.is_active)} onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "true" })} className="w-full px-3 py-2 border border-slate-300 rounded-lg"><option value="true">Activo</option><option value="false">Inactivo</option></select></div>
            {!editingUser && <div><label className="block text-sm font-medium mb-1">Contraseña *</label><Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required /></div>}
          </div>
          <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="outline" onClick={() => { setShowModal(false); setEditingUser(null); resetForm(); }}>Cancelar</Button><Button type="submit" disabled={submitting} loading={submitting}>{editingUser ? "Actualizar" : "Crear"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
