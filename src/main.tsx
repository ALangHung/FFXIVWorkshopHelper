import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App.tsx";

const base = import.meta.env.BASE_URL;
const routerBasename = base === "/" ? undefined : base.replace(/\/$/, "");

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
