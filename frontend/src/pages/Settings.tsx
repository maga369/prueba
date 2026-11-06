import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Card, Button, Input, Badge } from '../components/ui'
import { User, Key, Bell, Shield, Palette, Globe, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export function Settings() {
  const { user, keycloak, updateToken, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'appearance'>('profile')
  const [saving, setSaving] = useState(false)

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: <User className="h-5 w-5" /> },
    { id: 'security', label: 'Seguridad', icon: <Shield className="h-5 w-5" /> },
    { id: 'notifications', label: 'Notificaciones', icon: <Bell className="h-5 w-5" /> },
    { id: 'appearance', label: 'Apariencia', icon: <Palette className="h-5 w-5" /> },
  ]

  const handleSave = async () => {
    setSaving(true)
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (keycloak) {
      await updateToken()
    }
    toast.success('Configuración guardada')
    setSaving(false)
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-500">Gestiona tu perfil y preferencias</p>
      </div>

      {/* Tab navigation */}
      <Card variant="outlined">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <ProfileTab user={user} onSave={handleSave} saving={saving} />
          )}
          {activeTab === 'security' && (
            <SecurityTab keycloak={keycloak} onLogout={handleLogout} />
          )}
          {activeTab === 'notifications' && (
            <NotificationsTab />
          )}
          {activeTab === 'appearance' && (
            <AppearanceTab />
          )}
        </div>
      </Card>
    </div>
  )
}

function ProfileTab({ user, onSave, saving }: { user: any; onSave: () => void; saving: boolean }) {
  const [formData, setFormData] = useState({
    full_name: user?.name || '',
    email: user?.email || '',
    preferred_username: user?.preferred_username || '',
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave() }} className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary-700">
            {formData.full_name?.charAt(0).toUpperCase() || formData.email?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{formData.full_name || 'Sin nombre'}</h3>
          <p className="text-slate-500">{formData.email}</p>
          <Badge variant="outline" className="mt-1">{formData.preferred_username}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre completo"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
        />
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled
          helperText="El email se gestiona desde Keycloak"
        />
      </div>

      <Input
        label="Nombre de usuario"
        value={formData.preferred_username}
        onChange={(e) => setFormData({ ...formData, preferred_username: e.target.value })}
        helperText="Nombre de usuario en Keycloak"
      />

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4 mr-1" />
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}

function SecurityTab({ keycloak, onLogout }: { keycloak: any; onLogout: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Sesión actual</h3>
        <p className="text-slate-500 text-sm">Gestiona tu sesión y seguridad</p>
      </div>

      <Card variant="outlined" padding="md">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-slate-900">Renovar token</h4>
            <p className="text-sm text-slate-500">Actualiza tu token de acceso manualmente</p>
          </div>
          <Button variant="outline" onClick={() => keycloak?.updateToken(0)}>
            Renovar ahora
          </Button>
        </div>
      </Card>

      <Card variant="outlined" padding="md">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-slate-900">Cerrar sesión en todos los dispositivos</h4>
            <p className="text-sm text-slate-500">Invalida todas las sesiones activas</p>
          </div>
          <Button variant="danger" onClick={onLogout}>
            Cerrar sesión globalmente
          </Button>
        </div>
      </Card>

      <Card variant="outlined" padding="md">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-slate-900">Autenticación de dos factores (2FA)</h4>
            <p className="text-sm text-slate-500">Configura 2FA desde Keycloak</p>
          </div>
          <Button variant="outline" onClick={() => window.open(`${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}/account/security/signingin`, '_blank')}>
            Configurar en Keycloak
          </Button>
        </div>
      </Card>
    </div>
  )
}

function NotificationsTab() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [documentUpdates, setDocumentUpdates] = useState(true)
  const [approvalRequests, setApprovalRequests] = useState(true)
  const [systemAlerts, setSystemAlerts] = useState(true)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Preferencias de notificación</h3>
        <p className="text-slate-500 text-sm">Configura cómo quieres recibir avisos</p>
      </div>

      <Card variant="outlined" padding="md">
        <h4 className="font-medium text-slate-900 mb-4">Canales de notificación</h4>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Email</p>
              <p className="text-sm text-slate-500">Recibir notificaciones por correo electrónico</p>
            </div>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Push (navegador)</p>
              <p className="text-sm text-slate-500">Notificaciones push en el navegador</p>
            </div>
            <input
              type="checkbox"
              checked={pushNotifications}
              onChange={(e) => setPushNotifications(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
          </label>
        </div>
      </Card>

      <Card variant="outlined" padding="md">
        <h4 className="font-medium text-slate-900 mb-4">Tipos de notificación</h4>
        <div className="space-y-4">
          {[
            { key: 'documentUpdates', label: 'Actualizaciones de documentos', desc: 'Cuando un documento cambia de estado' },
            { key: 'approvalRequests', label: 'Solicitudes de aprobación', desc: 'Cuando un documento requiere tu aprobación' },
            { key: 'systemAlerts', label: 'Alertas del sistema', desc: 'Mantenimientos, actualizaciones, incidencias' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{label}</p>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
              <input
                type="checkbox"
                checked={eval(key)}
                onChange={(e) => eval(`set${key.charAt(0).toUpperCase() + key.slice(1)}`)(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}

function AppearanceTab() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [language, setLanguage] = useState<'es' | 'ca' | 'en'>('es')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Apariencia</h3>
        <p className="text-slate-500 text-sm">Personaliza la interfaz</p>
      </div>

      <Card variant="outlined" padding="md">
        <h4 className="font-medium text-slate-900 mb-4">Tema</h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'light', label: 'Claro', desc: 'Siempre tema claro' },
            { value: 'dark', label: 'Oscuro', desc: 'Siempre tema oscuro' },
            { value: 'system', label: 'Sistema', desc: 'Seguir preferencia del SO' },
          ].map(({ value, label, desc }) => (
            <label key={value} className="relative cursor-pointer">
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={(e) => setTheme(e.target.value as any)}
                className="sr-only"
              />
              <div className={clsx(
                'p-4 rounded-lg border-2 transition-colors text-center',
                theme === value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}>
                <p className="font-medium text-slate-900">{label}</p>
                <p className="text-sm text-slate-500 mt-1">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <Card variant="outlined" padding="md">
        <h4 className="font-medium text-slate-900 mb-4">Densidad de la interfaz</h4>
        <div className="grid grid-cols-2 gap-4">
          {[
            { value: 'comfortable', label: 'Cómoda', desc: 'Espaciado estándar' },
            { value: 'compact', label: 'Compacta', desc: 'Más información en pantalla' },
          ].map(({ value, label, desc }) => (
            <label key={value} className="relative cursor-pointer">
              <input
                type="radio"
                name="density"
                value={value}
                checked={density === value}
                onChange={(e) => setDensity(e.target.value as any)}
                className="sr-only"
              />
              <div className={clsx(
                'p-4 rounded-lg border-2 transition-colors text-center',
                density === value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}>
                <p className="font-medium text-slate-900">{label}</p>
                <p className="text-sm text-slate-500 mt-1">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <Card variant="outlined" padding="md">
        <h4 className="font-medium text-slate-900 mb-4">Idioma</h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'es', label: 'Español', flag: '🇪🇸' },
            { value: 'ca', label: 'Català', flag: '🏴' },
            { value: 'en', label: 'English', flag: '🇬🇧' },
          ].map(({ value, label, flag }) => (
            <label key={value} className="relative cursor-pointer">
              <input
                type="radio"
                name="language"
                value={value}
                checked={language === value}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="sr-only"
              />
              <div className={clsx(
                'p-4 rounded-lg border-2 transition-colors text-center',
                language === value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}>
                <p className="text-2xl">{flag}</p>
                <p className="font-medium text-slate-900 mt-2">{label}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}
