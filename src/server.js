import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const routesDir = path.join(process.cwd(), "src/routes");

// === 🧠 Carregar rotas recursivamente ===
function loadRoutes(dir, baseRoute = "") {
  const routes = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      routes.push(...loadRoutes(fullPath, `${baseRoute}/${file}`));
    } else if (file.endsWith(".js")) {
      const routePath = `${baseRoute}/${file.replace(".js", "")}`;
      import(fullPath).then((routeModule) => {
        app.get(routePath, routeModule.default);
        console.log(`✅ Rota carregada: ${routePath}`);
      });
      routes.push(routePath);
    }
  }
  return routes;
}

const allRoutes = loadRoutes(routesDir);

// === 🏠 Rota principal com HTML ===
app.get("/", (req, res) => {
  const routeLinks = allRoutes
    .map(
      (r) =>
        `<li><a href="${r}" target="_blank">${r}</a></li>`
    )
    .join("\n");

  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aura Utils API</title>
<style>
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #6e8efb, #a777e3);
    color: #fff;
    margin: 0;
    padding: 0;
  }
  header {
    padding: 2rem;
    text-align: center;
    background-color: rgba(0,0,0,0.3);
  }
  h1 { margin: 0; font-size: 2.5rem; }
  main { padding: 2rem; max-width: 800px; margin: auto; }
  ul { list-style: none; padding: 0; }
  li { margin: 0.5rem 0; }
  a {
    color: #ffeb3b;
    text-decoration: none;
    font-weight: bold;
    transition: 0.2s;
  }
  a:hover { color: #fff; text-decoration: underline; }
  footer { text-align: center; padding: 1rem; font-size: 0.9rem; color: #ddd; }
</style>
</head>
<body>
<header>
  <h1>🌌 Aura Utils API</h1>
  <p>Funções úteis para o Bot Designer for Discord (BDFD)</p>
</header>
<main>
  <h2>Funções disponíveis:</h2>
  <ul>
    ${routeLinks}
  </ul>
</main>
<footer>
  Feito com 💫 por Aura
</footer>
</body>
</html>`);
});

// === 🚀 Iniciar servidor localmente ===
app.listen(PORT, () => {
  console.log(`✨ Aura Utils API rodando em http://localhost:${PORT}`);
});
