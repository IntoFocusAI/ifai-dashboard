import { createRoot } from "react-dom/client";
import { HomeCanvasStatic } from "../components/v3/HomeCanvasStatic";

/* Offline single-file build of the canvas. It has no login: the Skip Login guest path was
   removed when the live dashboard made login required (23 Nov 2026). Its reads use the
   publishable key, so once the database requires a signed-in user it shows no client data. */
const root = document.getElementById("root");
if (root) createRoot(root).render(<HomeCanvasStatic />);
