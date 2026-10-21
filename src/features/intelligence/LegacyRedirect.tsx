import { Navigate, useLocation } from "react-router-dom";

/** Sends an old bookmark to its new home, keeping its query string (selected vehicle, plan, …). */
function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  const [path, query = ""] = to.split("?");
  const params = new URLSearchParams(query);
  new URLSearchParams(search).forEach((value, key) => params.set(key, value));
  const qs = params.toString();
  return <Navigate to={qs ? `${path}?${qs}` : path} replace />;
}

export default LegacyRedirect;
