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
import { ShieldCheck } from "lucide-react";

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
          user: { email: "local-dev@playground" },
          logout,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400 p-4 font-mono">
        Error: VITE_GOOGLE_CLIENT_ID is missing in .env (or set VITE_DEV_AUTH_BYPASS=true for local dev)
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthContext.Provider value={{ token, user: null, logout }}>
        {token ? (
          children
        ) : (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
                <ShieldCheck className="w-8 h-8 text-indigo-400" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Welcome Back
                </h1>
                <p className="text-slate-400">
                  Sign in to access your RAG Playground
                </p>
              </div>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleLoginSuccess}
                  onError={() => console.log("Login Failed")}
                  theme="filled_black"
                  shape="pill"
                />
              </div>

              <p className="text-xs text-slate-600">
                Your data is secure and isolated.
              </p>
            </div>
          </div>
        )}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}
