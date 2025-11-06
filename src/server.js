import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());

// ====== 🔧 CONFIGURAÇÕES ======
const PORT = process.env.PORT || 3000;
const routesDir = path.join(process.cwd(), "src/routes");
const pagesDir = path.join(process.cwd(), "src/pages");

// Servir arquivos estáticos, exceto rotas da API
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  express.static(pagesDir)(req, res, next);
});

// ====== 🧠 Carregar rotas recursivamente (APIs) ======
function loadRoutes(dir, baseRoute = "") {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      loadRoutes(fullPath, `${baseRoute}/${file}`);
    } else if (file.endsWith(".js")) {
      const routePath = `${baseRoute}/${file.replace(".js", "")}`;
      import(fullPath).then((routeModule) => {
        app.use(`/api${routePath}`, routeModule.default);
        console.log(`✅ API carregada: /api${routePath}`);
      });
    }
  }
}

loadRoutes(routesDir);

// ====== 📄 Carregar páginas HTML (com subpastas) ======
app.get("*", (req, res) => {
  const pagePath = req.path === "/" 
    ? path.join(pagesDir, "index.html")
    : path.join(pagesDir, `${req.path}.html`);

  if (fs.existsSync(pagePath)) {
    return res.sendFile(pagePath);
  }

  res.status(404).send("<h1>404 - Página não encontrada</h1>");
});

// ====== 🚀 Iniciar servidor ======
app.listen(PORT, () => {
  console.log(`✨ Aura Utils rodando em http://localhost:${PORT}`);
});
