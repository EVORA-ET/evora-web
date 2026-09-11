import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { AuthProvider } from "./app/AuthProvider";
import { TransitionProvider } from "./app/TransitionProvider";

function App() {
  return (
    <AuthProvider>
      <TransitionProvider>
        <RouterProvider router={router} />
      </TransitionProvider>
    </AuthProvider>
  );
}
export default App;