import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Dismiss the HTML boot sentinel on successful mount. If this module never
// executes (CSP block / 404 / proxy), the line never runs and the sentinel
// remains on screen — escalating to its self-diagnosis panel via pure CSS.
document.getElementById("boot-sentinel")?.remove();
