import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());

// ====== 🔧 CONFIG ======
const PORT = process.env.PORT || 3000;
const routesDir = path.join(process.cwd(), "src/routes/api");
const pagesDir = path.join(process.cwd(), "src/routes/pages");

// ====== 🧠 Carregar rotas da API (recursivo) ======
function loadApiRoutes(dir, baseRoute = "") {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      loadApiRoutes(fullPath, `${baseRoute}/${file}`);
    } else if (file.endsWith(".js")) {
      const routePath = `${baseRoute}/${file.replace(".js", "")}`;
      import(fullPath).then((routeModule) => {
        app.use(`/api${routePath}`, routeModule.default);
        console.log(`✅ API carregada: /api${routePath}`);
      });
    }
  }
}
loadApiRoutes(routesDir);

// ====== 📁 Servir arquivos estáticos ======
app.use(express.static(pagesDir));

/*
  ✅ PÁGINAS HTML COM SUPORTE A SUBPASTAS
  /                     → /src/routes/pages/index.html
  /docs                 → /src/routes/pages/docs.html
  /painel/home          → /src/routes/pages/painel/home.html
  /admin/logs/geral     → /src/routes/pages/admin/logs/geral.html
*/
app.get("*", (req, res) => {
  const requested = req.path === "/"
    ? "index"
    : req.path;

  const filePath = path.join(pagesDir, `${requested}.html`);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  return res.status(404).send(`<h1>404 - Página não encontrada</h1>`);
});

// ====== 🚀 Iniciar Servidor ======
app.listen(PORT, () => {
  console.log(`✨ Aura Utils rodando em http://localhost:${PORT}`);
});
