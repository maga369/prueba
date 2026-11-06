import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { documentsApi } from "../services/documents";
import { DocumentDetail, Entity, EntityAction } from "../types/api";
import { Button, Card, Badge, Modal } from "../components/ui";
import { ArrowLeft, Download, Save, RefreshCw, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [activeTab, setActiveTab] = useState<"original" | "redacted">("original");
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);

  const isTranscriptor = hasRole("transcriptor");

  const { data: document, isLoading, error, refetch } = useQuery({
    queryKey: ["document", id],
    queryFn: () => documentsApi.get(id!),
    enabled: !!id,
  });

  const updateEntityMutation = useMutation({
    mutationFn: ({ entityId, data }: { entityId: string; data: EntityUpdate }) => documentsApi.updateEntity(entityId, data),
    onSuccess: () => { toast.success("Entidad actualizada"); setShowEntityModal(false); refetch(); },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al actualizar"),
  });

  const approveMutation = useMutation({
    mutationFn: () => documentsApi.approve(id!),
    onSuccess: () => { toast.success("Documento aprobado"); navigate("/dashboard"); },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al aprobar"),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => documentsApi.reject(id!, reason),
    onSuccess: () => { toast.success("Documento rechazado"); navigate("/dashboard"); },
    onError: (error: any) => toast.error(error.response?.data?.detail || "Error al rechazar"),
  });

  useEffect(() => {
    if (document?.entities) setEntities(document.entities);
  }, [document]);

  const handleEntityUpdate = (entity: Entity, action: EntityAction, replacementText?: string) => {
    setEditingEntity(entity);
    setShowEntityModal(true);
  };

  const handleSubmitEntity = (action: EntityAction, replacementText?: string) => {
    if (editingEntity) {
      updateEntityMutation.mutate({ entityId: editingEntity.id, data: { action_taken: action, replacement_text: replacementText, reviewer_id: "current-user" } });
    }
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" /></div>;
  if (error) return <div className="text-center py-12 text-red-600">Error al cargar documento</div>;
  if (!document) return <div className="text-center py-12">Documento no encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Volver</Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{document.original_filename}</h1>
          <p className="text-slate-500">v{document.version} · {document.page_count} páginas · {document.status}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => documentsApi.export(id!, "pdf").then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `redacted_${document.original_filename}`; a.click(); URL.revokeObjectURL(url); })}><Download className="h-4 w-4 mr-2" />PDF</Button>
          <Button variant="outline" onClick={() => documentsApi.export(id!, "txt").then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `clean_${document.original_filename.replace(".pdf", ".txt")}`; a.click(); URL.revokeObjectURL(url); })}><Download className="h-4 w-4 mr-2" />TXT</Button>
        </div>
      </div>

      <Card>
        <div className="border-b border-slate-200">
          <nav className="flex gap-4" aria-label="Tabs">
            <Button variant={activeTab === "original" ? "default" : "ghost" } onClick={() => setActiveTab("original")}>Original</Button>
            <Button variant={activeTab === "redacted" ? "default" : "ghost" } onClick={() => setActiveTab("redacted")}>Anonimizado</Button>
          </nav>
        </div>
        <div className="p-6">
          <div className="bg-slate-50 rounded-lg p-6 min-h-[400px] font-mono text-sm whitespace-pre-wrap border border-slate-200">
            {activeTab === "original" ? document.ocr_text || "Sin texto OCR" : document.ocr_text || "Sin texto anonimizado"}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Entidades detectadas ({entities.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-4">Tipo</th>
                <th className="pb-2 pr-4">Texto</th>
                <th className="pb-2 pr-4">Página</th>
                <th className="pb-2 pr-4">Confianza</th>
                <th className="pb-2 pr-4">Acción actual</th>
                <th className="pb-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => (
                <tr key={entity.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4"><Badge>{entity.entity_type}</Badge></td>
                  <td className="py-2 pr-4 font-mono">{entity.original_text || document.ocr_text?.substring(entity.start_char, entity.end_char) || "..."}</td>
                  <td className="py-2 pr-4">{entity.page_num}</td>
                  <td className="py-2 pr-4">{(entity.confidence * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-4"><Badge variant={entity.action_taken === "REMOVE" ? "secondary" : "default"}>{entity.action_taken}</Badge></td>
                  <td className="py-2 pr-4">
                    {isTranscriptor && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEntityUpdate(entity, "REMOVE")} className="text-red-600">Eliminar</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEntityUpdate(entity, "GENERALIZE")}>Generalizar</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEntityUpdate(entity, "PSEUDONYMIZE")}>Pseudonimizar</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEntityUpdate(entity, "KEEP")} className="text-green-600">Mantener</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showEntityModal} onClose={() => { setShowEntityModal(false); setEditingEntity(null); }} title={`Editar: ${editingEntity?.entity_type}`} size="md">
        <div className="space-y-4">
          <p>Texto original: <code className="bg-slate-100 px-2 py-1 rounded">{editingEntity?.original_text || "..."}</code></p>
          <div>
            <label className="block text-sm font-medium mb-1">Acción</label>
            <div className="flex gap-2">
              {["REMOVE", "GENERALIZE", "PSEUDONYMIZE", "KEEP"].map((action) => (
                <Button key={action} variant={editingEntity?.action_taken === action ? "default" : "outline" } onClick={() => handleSubmitEntity(action as EntityAction)}>{action}</Button>
              ))}
            </div>
          </div>
          {(editingEntity?.action_taken === "GENERALIZE" || editingEntity?.action_taken === "PSEUDONYMIZE") && (
            <div>
              <label className="block text-sm font-medium mb-1">Texto de reemplazo</label>
              <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Ej: [NOMBRE], [DNI], etc." />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => { setShowEntityModal(false); setEditingEntity(null); }}>Cancelar</Button>
            <Button onClick={() => handleSubmitEntity(editingEntity?.action_taken || "REMOVE")}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
