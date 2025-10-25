export default (req, res) => {
  let { value, style } = req.query;

  // === HTML explicativo seguro se não passar valor ===
  if (!value) {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Format Number - Aura Utils API</title>
<style>
body { font-family: 'Segoe UI', sans-serif; background: #1e1e2f; color: #fff; margin:0; padding:0; }
header { background: #6e8efb; padding: 2rem; text-align: center; border-bottom: 4px solid #a777e3; }
header h1 { margin:0; font-size:2.5rem; }
main { max-width: 900px; margin: 2rem auto; padding: 1.5rem; background: rgba(0,0,0,0.3); border-radius:10px; line-height:1.6; }
code { background: #333; padding: 0.2rem 0.5rem; border-radius:4px; }
ul { list-style: disc inside; margin-left:0; padding-left:0; }
a { color: #ffeb3b; text-decoration: none; }
a:hover { text-decoration: underline; }
footer { text-align:center; margin:2rem 0; color:#ccc; }
h2 { margin-top:1.5rem; }
</style>
</head>
<body>
<header>
<h1>🌌 Format Number API</h1>
<p>Aura Utils - Formata números grandes e converte sufixos automaticamente</p>
</header>
<main>
<h2>Como usar:</h2>
<ul>
<li><strong>Formato curto (short)</strong>: <code>?value=1500</code> → <strong>1.5K</strong></li>
<li><strong>Formato longo (long)</strong>: <code>?value=1500&style=long</code> → <strong>1.5 mil</strong></li>
<li><strong>Formato com pontos (point)</strong>: <code>?value=1234567&style=point</code> → <strong>1.234.567</strong></li>
<li><strong>Formato moeda (currency)</strong>: <code>?value=1234.56&style=currency</code> → <strong>R$ 1.234,56</strong></li>
<li><strong>Conversão de sufixo</strong>: <code>?value=1.5K</code> → <strong>1500</strong></li>
<li>Suporta T (trilhão), B (bilhão), M (milhão), K (mil)</li>
<li>Valores negativos e decimais também são suportados</li>
</ul>
<h2>Exemplo BDFD:</h2>
<code>$eval[$httpGet[https://aura-utils.vercel.app/api/utils/formatNumber?value=2.3M]]</code>
<h2>Observações:</h2>
<ul>
<li>Não é necessário informar o estilo se quiser o padrão curto</li>
<li>A API detecta automaticamente sufixos e converte para número</li>
<li>Retorna valor arredondado em decode automático</li>
</ul>
</main>
<footer>Feito com 💫 por Aura</footer>
</body>
</html>
`;
    res.setHeader("Content-Type", "text/html");
    return res.send(html);
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
      if (Math.abs(value) >= 1e12) result = (value / 1e12).toFixed(1) + "T";
      else if (Math.abs(value) >= 1e9) result = (value / 1e9).toFixed(1) + "B";
      else if (Math.abs(value) >= 1e6) result = (value / 1e6).toFixed(1) + "M";
      else if (Math.abs(value) >= 1e3) result = (value / 1e3).toFixed(1) + "K";
      else result = value.toString();
      break;
    case "long":
      const absValue = Math.abs(value);
      if (absValue >= 1e12) result = (value / 1e12).toFixed(1) + (absValue / 1e12 === 1 ? " trilhão" : " trilhões");
      else if (absValue >= 1e9) result = (value / 1e9).toFixed(1) + (absValue / 1e9 === 1 ? " bilhão" : " bilhões");
      else if (absValue >= 1e6) result = (value / 1e6).toFixed(1) + (absValue / 1e6 === 1 ? " milhão" : " milhões");
      else if (absValue >= 1e3) result = (value / 1e3).toFixed(1) + " mil";
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
