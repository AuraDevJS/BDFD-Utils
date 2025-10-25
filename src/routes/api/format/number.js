export default (req, res) => {
  let { value, style } = req.query;

  // === HTML explicativo se não passar valor ===
  if (!value) {
    res.setHeader("Content-Type", "text/html");
    return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Format Number - Aura Utils API</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; background: #1e1e2f; color: #fff; margin:0; padding:0; }
  header { background: #6e8efb; padding: 2rem; text-align: center; border-bottom: 4px solid #a777e3; }
  header h1 { margin:0; font-size:2.5rem; }
  main { max-width: 800px; margin: 2rem auto; padding: 1rem; background: rgba(0,0,0,0.3); border-radius:10px; }
  code { background: #333; padding: 0.2rem 0.5rem; border-radius:4px; }
  ul { line-height:1.6; }
  a { color: #ffeb3b; text-decoration: none; }
  a:hover { text-decoration: underline; }
  footer { text-align:center; margin:2rem 0; color:#ccc; }
</style>
</head>
<body>
<header>
  <h1>🌌 Format Number API</h1>
  <p>Aura Utils - Formata números e converte sufixos automaticamente</p>
</header>
<main>
  <h2>Como usar:</h2>
  <ul>
    <li>Formato curto (padrão): <code>?value=1500</code> → <strong>1.5K</strong></li>
    <li>Estilo longo: <code>?value=1500&style=long</code> → <strong>1.5 mil</strong></li>
    <li>Estilo com ponto: <code>?value=1234567&style=point</code> → <strong>1.234.567</strong></li>
    <li>Conversão de sufixo: <code>?value=1.5K</code> → <strong>1500</strong></li>
    <li>Suporta T, B, M, K (ex: 2.3M → 2300000)</li>
  </ul>
  <p>Exemplo no BDFD:</p>
  <code>$eval[$httpGet[https://aura-utils.vercel.app/api/utils/formatNumber?value=2.3M]]</code>
</main>
<footer>
  Feito com 💫 por Aura
</footer>
</body>
</html>`);
  }

  // === Detecção automática de sufixo ===
  const suffixMultipliers = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  const suffixRegex = /^([\d.,]+)\s*([KMBT])$/i;

  const match = value.toUpperCase().match(suffixRegex);
  if (match) {
    let number = parseFloat(match[1].replace(",", "."));
    const suffix = match[2];
    number *= suffixMultipliers[suffix];
    res.setHeader("Content-Type", "text/plain");
    return res.send(Math.round(number).toString());
  }

  // === Número puro ===
  value = parseFloat(value.replace(",", "."));
  if (isNaN(value)) return res.send("❌ Valor inválido");

  if (!style) style = "short";

  let result;
  switch (style) {
    case "short":
      if (value >= 1e12) result = (value / 1e12).toFixed(1) + "T";
      else if (value >= 1e9) result = (value / 1e9).toFixed(1) + "B";
      else if (value >= 1e6) result = (value / 1e6).toFixed(1) + "M";
      else if (value >= 1e3) result = (value / 1e3).toFixed(1) + "K";
      else result = value.toString();
      break;
    case "long":
      if (value >= 1e12) result = (value / 1e12).toFixed(1) + " trilhão(s)";
      else if (value >= 1e9) result = (value / 1e9).toFixed(1) + " bilhão(s)";
      else if (value >= 1e6) result = (value / 1e6).toFixed(1) + " milhão(ões)";
      else if (value >= 1e3) result = (value / 1e3).toFixed(1) + " mil";
      else result = value.toString();
      break;
    case "point":
      result = value.toLocaleString("pt-BR");
      break;
    case "currency":
      result = value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      break;
    default:
      result = value.toString();
  }

  res.setHeader("Content-Type", "text/plain");
  res.send(result);
};
