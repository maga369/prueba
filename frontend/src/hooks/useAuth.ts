import { create } from "zustand";
import { persist } from "zustand/middleware";
import Keycloak from "keycloak-js";
import { UserInfo, UserRole } from "../types/api";

interface AuthState {
  user: UserInfo | null;
  keycloak: Keycloak | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  initKeycloak: () => Promise<void>;
  updateToken: () => Promise<boolean>;
}

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM || "legal-redactor",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "frontend",
};

function mapKeycloakUser(kc: Keycloak): UserInfo {
  const tp = kc.tokenParsed || {};
  const roles: UserRole[] = (tp.realm_access?.roles as UserRole[]) || [];
  return {
    id: kc.subject || tp.sub || "",
    email: tp.email || "",
    full_name: tp.name,
    preferred_username: tp.preferred_username || "",
    role: roles[0] || "transcriptor",
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      keycloak: null,
      isLoading: true,
      isAuthenticated: false,

      hasRole: (role: UserRole) => {
        const { user } = get();
        if (!user) return false;
        return user.role === role;
      },

      initKeycloak: async () => {
        const kc = new Keycloak(keycloakConfig);

        try {
          const authenticated = await kc.init({
            onLoad: "check-sso",
            silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
            pkceMethod: "S256",
          });

          if (authenticated && kc.tokenParsed) {
            const userInfo = mapKeycloakUser(kc);
            set({ user: userInfo, keycloak: kc, isAuthenticated: true, isLoading: false });

            // Auto-refresh token
            setInterval(() => {
              kc.updateToken(30).then((refreshed) => {
                if (refreshed && kc.tokenParsed) {
                  set({ user: mapKeycloakUser(kc) });
                }
              });
            }, 30000);
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error("Keycloak init failed:", error);
          set({ isLoading: false });
        }
      },

      login: async () => {
        const { keycloak } = get();
        if (keycloak) {
          await keycloak.login({ redirectUri: window.location.origin });
        }
      },

      logout: async () => {
        const { keycloak } = get();
        if (keycloak) {
          await keycloak.logout({ redirectUri: window.location.origin });
        }
        set({ user: null, isAuthenticated: false });
      },

      updateToken: async () => {
        const { keycloak } = get();
        if (keycloak) {
          return await keycloak.updateToken(30);
        }
        return false;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
