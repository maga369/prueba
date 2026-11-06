import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { rulesApi } from "../services/rules";
import { Rule, RuleCreate, RuleUpdate, RuleListItem, EntityAction } from "../types/api";
import { Button, Card, Table, Pagination, Input, Modal, Badge } from "../components/ui";
import { Plus, Edit, Trash2, Search, Save, X } from "lucide-react";
import toast from "react-hot-toast";

export function AdminRules() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleListItem | null>(null);
  const [formData, setFormData] = useState<RuleCreate>({
    name: "",
    description: "",
    entity_type: "",
    pattern_regex: "",
    action: "REMOVE",
    config: {},
  });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = hasRole("admin");

  const { data: rules, isLoading, error } = useQuery({
    queryKey: ["rules", page, pageSize, searchQuery],
    queryFn: () => rulesApi.list({ page, page_size: pageSize, search: searchQuery || undefined }),
  });

  const total = rules?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const items = rules?.items || [];

  const createMutation = useMutation({
    mutationFn: (data: RuleCreate) => rulesApi.create(data),
    onSuccess: () => {
      toast.success("Regla creada");
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al crear"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RuleUpdate }) => rulesApi.update(id, data),
    onSuccess: () => {
      toast.success("Regla actualizada");
      setShowModal(false);
      setEditingRule(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rulesApi.delete(id),
    onSuccess: () => {
      toast.success("Regla eliminada");
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al eliminar"),
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", entity_type: "", pattern_regex: "", action: "REMOVE", config: {} });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData }, { onSettled: () => setSubmitting(false) });
    } else {
      createMutation.mutate(formData, { onSettled: () => setSubmitting(false) });
    }
  };

  const handleEdit = (rule: RuleListItem) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: "",
      entity_type: rule.entity_type,
      pattern_regex: "",
      action: rule.action,
      config: {},
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("¿Eliminar esta regla?")) {
      deleteMutation.mutate(id);
    }
  };

  const columns = [
    { key: "name", header: "Nombre", render: (r: RuleListItem) => <span className="font-medium">{r.name}</span> },
    { key: "entity_type", header: "Tipo entidad", render: (r: RuleListItem) => <Badge>{r.entity_type}</Badge> },
    { key: "action", header: "Acción", render: (r: RuleListItem) => <Badge variant="secondary">{r.action}</Badge> },
    { key: "is_active", header: "Activa", render: (r: RuleListItem) => (r.is_active ? <span className="text-green-600">Sí</span> : <span className="text-red-600">No</span>) },
    { key: "version", header: "Versión", render: (r: RuleListItem) => <span>v{r.version}</span> },
    { key: "created_at", header: "Creado", render: (r: RuleListItem) => <span className="text-sm">{new Date(r.created_at).toLocaleDateString()}</span> },
    {
      key: "actions",
      header: "Acciones",
      render: (r: RuleListItem) => (
        <div className="flex items-center gap-1">
          {isAdmin && (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (error) return <div className="text-center py-12 text-red-600">Error al cargar reglas</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de reglas</h1>
          <p className="text-slate-500">Configura reglas de detección y anonimización de PII</p>
        </div>
        {isAdmin && <Button onClick={() => { resetForm(); setEditingRule(null); setShowModal(true); }}><Plus className="h-4 w-4 mr-2" />Nueva regla</Button>}
      </div>

      <Card variant="outlined" padding="md">
        <Input placeholder="Buscar reglas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
      </Card>

      <Card>
        {isLoading ? (
          <Table columns={columns} data={[]} keyExtractor={(r) => r.id} loading />
        ) : (
          <>
            <Table columns={columns} data={items} keyExtractor={(r) => r.id} />
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} totalItems={total} onPageSizeChange={setPageSize} />
          </>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingRule(null); resetForm(); }} title={editingRule ? "Editar regla" : "Nueva regla"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de entidad *</label>
              <Input value={formData.entity_type} onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })} placeholder="PERSON, DNI, CIF, etc." required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripción opcional" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Regex personalizado</label>
              <Input value={formData.pattern_regex} onChange={(e) => setFormData({ ...formData, pattern_regex: e.target.value })} placeholder="Regex opcional" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Acción *</label>
              <select value={formData.action} onChange={(e) => setFormData({ ...formData, action: e.target.value as EntityAction })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="REMOVE">Eliminar</option>
                <option value="GENERALIZE">Generalizar</option>
                <option value="PSEUDONYMIZE">Pseudonimizar</option>
                <option value="KEEP">Mantener</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => { setShowModal(false); setEditingRule(null); resetForm(); }}>Cancelar</Button>
            <Button type="submit" disabled={submitting} loading={submitting}>{editingRule ? "Actualizar" : "Crear"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
