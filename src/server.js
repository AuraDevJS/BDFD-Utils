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

// Servir arquivos estáticos (CSS, JS, Imagens, HTML)
app.use(express.static(pagesDir));

/*
  ✅ SUPORTE A SUBPASTAS PARA PÁGINAS
  - /           → /src/pages/index.html
  - /docs       → /src/pages/docs.html
  - /painel/home → /src/pages/painel/home.html
  - /admin/users/logs → /src/pages/admin/users/logs.html
*/

app.get("*", (req, res, next) => {
  let page = req.path === "/" ? "/index" : req.path;
  const pagePath = path.join(pagesDir, `${page}.html`);

  if (fs.existsSync(pagePath)) {
    res.sendFile(pagePath);
  } else {
    next();
  }
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

// ====== 🚀 Iniciar servidor ======
app.listen(PORT, () => {
  console.log(`✨ Aura Utils rodando em http://localhost:${PORT}`);
});
