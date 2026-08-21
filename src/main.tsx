import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LibraryExplorer from "../app/LibraryExplorer";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LibraryExplorer />
  </StrictMode>,
);
