import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./useAuth";
import PageLoader from "../components/ui/PageLoader";
import SignOutButton from "../components/ui/SignOutButton";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { sessionReady, accessToken } = useAuth();
  const location = useLocation();

  if (!sessionReady) {
    return <PageLoader active />;

  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return (
    <>
      <SignOutButton />
      {children}
    </>
  );
}
