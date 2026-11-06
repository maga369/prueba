import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button, Card, Input } from "../components/ui";
import { User, Key, Bell, Save } from "lucide-react";
import toast from "react-hot-toast";

export function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications">("profile");
  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    current_password: "",
    new_password: "",
    confirm_password: "",
    email_notifications: true,
    document_updates: true,
    approval_requests: true,
    system_alerts: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    toast.success("Configuración guardada");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>

      <div className="flex gap-4 border-b border-slate-200">
        {["profile", "security", "notifications"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "ghost"}
            onClick={() => setActiveTab(tab)}
            className="border-b-2 border-transparent hover:border-primary-300"
          >
            {tab === "profile" && <User className="h-4 w-4 mr-2" />}
            {tab === "security" && <Key className="h-4 w-4 mr-2" />}
            {tab === "notifications" && <Bell className="h-4 w-4 mr-2" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {activeTab === "profile" && (
            <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre completo</label>
                <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Rol</label>
                <Input value={user?.role || ""} disabled />
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
              <div>
                <label className="block text-sm font-medium mb-1">Contraseña actual</label>
                <Input type="password" value={formData.current_password} onChange={(e) => setFormData({ ...formData, current_password: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
                <Input type="password" value={formData.new_password} onChange={(e) => setFormData({ ...formData, new_password: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Confirmar nueva contraseña</label>
                <Input type="password" value={formData.confirm_password} onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })} />
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-4 max-w-md">
              {[
                { key: "email_notifications", label: "Notificaciones por email" },
                { key: "document_updates", label: "Actualizaciones de documentos" },
                { key: "approval_requests", label: "Solicitudes de aprobación" },
                { key: "system_alerts", label: "Alertas del sistema" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[key as keyof typeof formData] as boolean}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                    className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <Button type="submit" disabled={saving} loading={saving}><Save className="h-4 w-4 mr-2" />Guardar cambios</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
