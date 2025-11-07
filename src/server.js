// src/server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Diretórios
const pagesDir = path.join(__dirname, "routes/pages");
const apiDir = path.join(__dirname, "routes/api");
const assetsDir = path.join(__dirname, "assets");

// Servir assets
app.use("/assets", express.static(assetsDir));

// Registro das páginas HTML
function loadPages(dir, baseRoute = "") {
  if (!fs.existsSync(dir)) return;

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      const indexExists = fs.existsSync(path.join(fullPath, "index.html"));
      const route = indexExists ? `${baseRoute}/${item.name}` : baseRoute;
      loadPages(fullPath, route);
      continue;
    }

    if (item.name.endsWith(".html")) {
      const pageName = item.name.replace(".html", "");
      const routePath = pageName === "index" ? baseRoute || "/" : `${baseRoute}/${pageName}`;

      app.get(routePath, (_, res) => res.sendFile(fullPath));
      console.log(`📄 Página carregada: ${routePath}`);
    }
  }
}

// Registro das APIs
async function loadAPIs(dir, baseRoute = "/api") {
  if (!fs.existsSync(dir)) return;

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      await loadAPIs(fullPath, `${baseRoute}/${item.name}`);
      continue;
    }

    if (item.name.endsWith(".js")) {
      const route = `${baseRoute}/${item.name.replace(".js", "")}`;

      try {
        const module = await import(fullPath);
        const handler = module.default;

        if (typeof handler === "function") {
          app.all(route, handler);
          console.log(`⚡ API carregada: ${route}`);
        } else {
          console.warn(`❌ Ignorado: ${route} (export default não é função)`);
        }
      } catch (err) {
        console.error(`❌ Erro ao carregar API ${route}:`, err.message);
      }
    }
  }
}

loadPages(pagesDir);
await loadAPIs(apiDir);

// 404
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    error: "Rota não encontrada",
    route: req.originalUrl
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado: http://localhost:${PORT}`);
});
