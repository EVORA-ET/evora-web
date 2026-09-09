import { createContext } from "react";

interface AuthState {
  sessionReady: boolean;
  accessToken: string | null;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(
  null,
);
