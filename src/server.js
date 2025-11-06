// src/server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Diretórios principais
const pagesDir = path.join(process.cwd(), "src/routes/pages");
const apiDir = path.join(process.cwd(), "src/routes/api");
const assetsDir = path.join(process.cwd(), "src/assets");

// Servir assets públicos via /assets
app.use("/assets", express.static(assetsDir));

/* ============================================================
   📌 Função para registrar PÁGINAS (HTML) com rotas amigáveis
   ------------------------------------------------------------
   - /folder/index.html  → /folder
   - /folder/page.html   → /folder/page
   - Ignora pastas sem HTML
   ============================================================ */
function loadPages(dir, baseRoute = "") {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      const hasIndex = fs.existsSync(path.join(fullPath, "index.html"));

      // Só cria rota da pasta se tiver index.html
      const route = hasIndex ? `${baseRoute}/${item}` : baseRoute;
      loadPages(fullPath, route);
      continue;
    }

    if (item.endsWith(".html")) {
      const pageName = item.replace(".html", "");
      const routePath =
        pageName === "index" ? baseRoute || "/" : `${baseRoute}/${pageName}`;

      app.get(routePath, (req, res) => res.sendFile(fullPath));
      console.log(`📄 Página carregada: ${routePath}`);
    }
  }
}

/* ============================================================
   🔥 Função para registrar APIs
   ------------------------------------------------------------
   - Cada .js vira rota com caminho literal
   - /api/tools/index.js → /api/tools/index
   ============================================================ */
function loadAPIs(dir, baseRoute = "/api") {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      loadAPIs(fullPath, `${baseRoute}/${item}`);
    } else if (item.endsWith(".js")) {
      const route = `${baseRoute}/${item.replace(".js", "")}`;

      import(fullPath).then((module) => {
        app.get(route, module.default);
        console.log(`⚡ API carregada: ${route}`);
      });
    }
  }
}

// Carregar páginas e APIs
loadPages(pagesDir);
loadAPIs(apiDir);

// Rota fallback — 404 amigável
app.use((req, res) => {
  res.status(404).send(`
    <h1 style="font-family:sans-serif;color:#a44">404 • Página não encontrada</h1>
    <p>Você tentou acessar: ${req.originalUrl}</p>
  `);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
