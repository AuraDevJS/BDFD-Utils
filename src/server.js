// === 🌌 Aura Utils API ===
// Estrutura modular para hospedar funções do BDFD
// Feito para rodar perfeitamente na Vercel, Railway ou Render

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());

// 🔹 Porta local (ignorada pela Vercel)
const PORT = process.env.PORT || 3000;

// 🔹 Diretório das rotas de utilidades
const routesDir = path.join(process.cwd(), "routes");

// === 🧠 Carregar todas as rotas automaticamente ===
fs.readdirSync(routesDir).forEach((file) => {
  if (file.endsWith(".js")) {
    const routePath = `/` + file.replace(".js", "");
    import(`./routes/${file}`).then((routeModule) => {
      app.get(routePath, routeModule.default);
      console.log(`✅ Rota carregada: ${routePath}`);
    });
  }
});

// === 🏠 Rota principal ===
app.get("/", (req, res) => {
  const list = fs
    .readdirSync(routesDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => `/${f.replace(".js", "")}`)
    .join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.send(`🌌 Aura Utils API
Funções disponíveis:
${list}

Use: https://aura-utils.vercel.app/<função>?parametros
Feito com 💫 por Aura`);
});

// === 🚀 Iniciar servidor localmente ===
app.listen(PORT, () => {
  console.log(`✨ Aura Utils API rodando em http://localhost:${PORT}`);
});
