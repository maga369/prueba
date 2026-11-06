import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui'
import { LoadingSpinner } from '../components/ui'

export function Login() {
  const { initKeycloak, login, isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    initKeycloak()
  }, [initKeycloak])

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/dashboard'
    }
  }, [isAuthenticated])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
              <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Legal Redactor</h1>
            <p className="text-slate-500 mt-1">iCAT - Anonimización de documentos</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <Button
              onClick={login}
              className="w-full"
              size="lg"
            >
              Iniciar sesión con Keycloak
            </Button>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            <p>¿Problemas para acceder?</p>
            <p>Contacta con el administrador del sistema</p>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          <p>Versión 0.1.0</p>
        </div>
      </div>
    </div>
  )
}
