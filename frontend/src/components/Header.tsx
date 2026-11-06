import { useLocation } from "react-router-dom";

interface HeaderProps {
  user: {
    preferred_username?: string;
  } | null;
}

export function Header({ user }: HeaderProps) {
  const location = useLocation();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {location.pathname === "/dashboard" && "Documentos"}
            {location.pathname.startsWith("/document") && "Revisión de documento"}
            {location.pathname.startsWith("/approval") && "Aprobación"}
            {location.pathname.startsWith("/admin/rules") && "Gestión de reglas"}
            {location.pathname.startsWith("/admin/users") && "Gestión de usuarios"}
            {location.pathname === "/settings" && "Configuración"}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user?.preferred_username}</span>
        </div>
      </div>
    </header>
  );
}
