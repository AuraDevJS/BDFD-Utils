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

const PORT = process.env.PORT || 3000;

// Diretórios
const pagesDir = path.join(__dirname, "routes/pages");
const apiDir = path.join(__dirname, "routes/api");
const assetsDir = path.join(__dirname, "assets");

// Servir assets
app.use("/assets", express.static(assetsDir));

function loadPages(dir, baseRoute = "") {
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
      const routePath =
        pageName === "index" ? baseRoute || "/" : `${baseRoute}/${pageName}`;
      app.get(routePath, (_, res) => res.sendFile(fullPath));
      console.log(`📄 Página carregada: ${routePath}`);
    }
  }
}

function loadAPIs(dir, baseRoute = "/api") {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      loadAPIs(fullPath, `${baseRoute}/${item.name}`);
      continue;
    }

    if (item.name.endsWith(".js")) {
      const route = `${baseRoute}/${item.name.replace(".js", "")}`;

      import(fullPath).then((module) => {
        const handler = module.default;
        if (typeof handler === "function") {
          app.all(route, handler);
          console.log(`⚡ API carregada: ${route}`);
        } else {
          console.warn(`❌ Ignorado: ${route} (export default não é função)`);
        }
      });
    }
  }
}

loadPages(pagesDir);
loadAPIs(apiDir);

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
