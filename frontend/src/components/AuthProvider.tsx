import {
  GoogleOAuthProvider,
  GoogleLogin,
  CredentialResponse,
} from "@react-oauth/google";
import {
  useEffect,
  useState,
  createContext,
  useContext,
  ReactNode,
} from "react";

interface AuthContextType {
  token: string | null;
  user: { email?: string } | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const devBypass = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("google_token") || (devBypass ? "dev-bypass-token" : null)
  );

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      setToken(credentialResponse.credential);
      localStorage.setItem("google_token", credentialResponse.credential);
    }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("google_token");
  };

  useEffect(() => {
    const handleLogoutEvent = () => logout();
    window.addEventListener("auth:logout", handleLogoutEvent);
    return () => window.removeEventListener("auth:logout", handleLogoutEvent);
  }, []);

  if (devBypass) {
    return (
      <AuthContext.Provider
        value={{
          token: token || "dev-bypass-token",
          user: { email: "local-dev" },
          logout,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-400 p-4 font-mono text-sm">
        VITE_GOOGLE_CLIENT_ID is missing in .env (or set VITE_DEV_AUTH_BYPASS=true for local dev).
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthContext.Provider value={{ token, user: null, logout }}>
        {token ? (
          children
        ) : (
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5">
              <div className="space-y-1">
                <p className="font-mono text-xs text-zinc-500">
                  gcp-rag-playground
                </p>
                <h1 className="text-lg font-semibold text-zinc-100">
                  Sign in
                </h1>
              </div>

              <div className="flex justify-start">
                <GoogleLogin
                  onSuccess={handleLoginSuccess}
                  onError={() => console.log("Login Failed")}
                  theme="filled_black"
                  shape="rectangular"
                />
              </div>
            </div>
          </div>
        )}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}
