import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { documentsApi } from "../services/documents";
import { DocumentDetail, Entity } from "../types/api";
import { Button, Card, Badge, Modal } from "../components/ui";
import { ArrowLeft, Download, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export function ApprovalView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"original" | "redacted">("original");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isAprobador = hasRole("aprobador");

  const { data: document, isLoading, error, refetch } = useQuery({
    queryKey: ["document", id],
    queryFn: () => documentsApi.get(id!),
    enabled: !!id,
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

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" /></div>;
  if (error) return <div className="text-center py-12 text-red-600">Error al cargar documento</div>;
  if (!document) return <div className="text-center py-12">Documento no encontrado</div>;

  const entities = document.entities || [];

  const handleReject = () => {
    if (rejectReason.trim()) {
      rejectMutation.mutate(rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Volver</Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{document.original_filename}</h1>
          <p className="text-slate-500">v{document.version} · {document.page_count} páginas · {document.status}</p>
        </div>
        <div className="flex gap-2">
          {isAprobador && (
            <>
              <Button variant="outline" onClick={() => documentsApi.export(id!, "pdf").then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `redacted_${document.original_filename}`; a.click(); URL.revokeObjectURL(url); })}><Download className="h-4 w-4 mr-2" />PDF</Button>
              <Button onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}><CheckCircle className="h-4 w-4 mr-2" />Aprobar</Button>
              <Button variant="outline" onClick={() => setShowRejectModal(true)} className="text-red-600 border-red-300"><XCircle className="h-4 w-4 mr-2" />Rechazar</Button>
            </>
          )}
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
        <h2 className="text-lg font-semibold mb-4">Entidades ({entities.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-4">Tipo</th>
                <th className="pb-2 pr-4">Texto</th>
                <th className="pb-2 pr-4">Página</th>
                <th className="pb-2 pr-4">Confianza</th>
                <th className="pb-2 pr-4">Acción aplicada</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showRejectModal} onClose={() => { setShowRejectModal(false); setRejectReason(""); }} title="Rechazar documento" size="md">
        <div className="space-y-4">
          <p className="text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Esta acción devolverá el documento al transcriptor para corrección.</p>
          <div>
            <label className="block text-sm font-medium mb-1">Motivo del rechazo *</label>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="Describe por qué se rechaza el documento..." required />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(""); }}>Cancelar</Button>
            <Button onClick={handleReject} className="bg-red-600 hover:bg-red-700" loading={rejectMutation.isPending}>Confirmar rechazo</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
