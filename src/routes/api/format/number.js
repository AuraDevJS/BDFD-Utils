export default (req, res) => {
  const { value, style = "short", mode = "txt" } = req.query;

  // ======================= HTML HELP PAGE =======================
  if (!value) {
    const html = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Format Number - Aura Utils API</title>
<style>
body{font-family:'Segoe UI',sans-serif;background:#1e1e2f;color:#fff;margin:0;padding:0}
header{background:#6e8efb;padding:2rem;text-align:center;border-bottom:4px solid #a777e3}
header h1{margin:0;font-size:2.4rem}
main{max-width:900px;margin:2rem auto;padding:1.5rem;background:rgba(0,0,0,.3);border-radius:10px;line-height:1.6}
code{background:#333;padding:.2rem .5rem;border-radius:4px}
ul{list-style:disc inside;margin-left:0;padding-left:0}
footer{text-align:center;margin:2rem 0;color:#ccc}
h2{margin-top:1.3rem}
</style></head>
<body><header>
<h1>🌌 Format Number API</h1>
<p>Aura Utils • Formata números com múltiplos estilos e conversão automática</p>
</header><main>
<h2>Parâmetros:</h2>
<ul>
<li><strong>value</strong>: número ou número com sufixo (ex: 2.5K, 3M)</li>
<li><strong>style</strong>: short, long, point, currency, compact, scientific, roman, binary, ordinal, percent, time, bytes</li>
<li><strong>mode</strong>: txt (padrão) ou json</li>
</ul>
</main><footer>Feito com 💫 por Aura</footer></body></html>`;
    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  }

  // ================ CONVERSÃO DE SUFIXO PARA NÚMERO ================
  const suffixMultipliers = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15 };
  const suffixRegex = /^([\d.,]+)\s*([KMBTQ])$/i;

  const match = value.toUpperCase().match(suffixRegex);
  let num;

  if (match) {
    num = parseFloat(match[1].replace(",", "."));
    num *= suffixMultipliers[match[2]];
  } else {
    num = parseFloat(String(value).replace(",", "."));
  }

  if (isNaN(num)) {
    res.setHeader("Content-Type", "text/plain");
    return res.send("❌ Valor inválido");
  }

  // ======================= FORMATADORES =======================
  const formats = {
    short: (() => {
      const abs = Math.abs(num);
      if (abs >= 1e15) return (num / 1e15).toFixed(1) + "Q";
      if (abs >= 1e12) return (num / 1e12).toFixed(1) + "T";
      if (abs >= 1e9) return (num / 1e9).toFixed(1) + "B";
      if (abs >= 1e6) return (num / 1e6).toFixed(1) + "M";
      if (abs >= 1e3) return (num / 1e3).toFixed(1) + "K";
      return num.toString();
    })(),
    long: (() => {
      const abs = Math.abs(num);
      if (abs >= 1e15) return (num / 1e15).toFixed(1) + " quatrilhão";
      if (abs >= 1e12) return (num / 1e12).toFixed(1) + " trilhão";
      if (abs >= 1e9) return (num / 1e9).toFixed(1) + " bilhão";
      if (abs >= 1e6) return (num / 1e6).toFixed(1) + " milhão";
      if (abs >= 1e3) return (num / 1e3).toFixed(1) + " mil";
      return num.toString();
    })(),
    point: num.toLocaleString("pt-BR"),
    currency: num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    compact: Intl.NumberFormat("pt-BR", { notation: "compact" }).format(num),
    scientific: num.toExponential(2),
    roman: (() => {
      const n = Math.floor(num);
      if (n <= 0 || n > 3999) return "N/A";
      const map = [
        [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
        [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
        [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
      ];
      let r = "", v = n;
      for (const [val, s] of map) while (v >= val) r += s, v -= val;
      return r;
    })(),
    binary: Math.floor(num).toString(2),
    ordinal: (() => {
      const n = Math.floor(num);
      if (n === 0) return "0º";
      return n + "º";
    })(),
    percent: (num * 100).toFixed(2) + "%",
    time: (() => {
      let secs = Math.floor(num);
      const h = Math.floor(secs / 3600);
      secs %= 3600;
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${h}h ${m}m ${s}s`;
    })(),
    bytes: (() => {
      const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
      let v = num, i = 0;
      while (v >= 1024 && i < sizes.length - 1) v /= 1024, i++;
      return v.toFixed(2) + " " + sizes[i];
    })()
  };

  // =================== RESPOSTA EM JSON OU TXT ===================
  if (mode === "json") {
    res.setHeader("Content-Type", "application/json");
    return res.json({ input: value, number: num, ...formats });
  }

  res.setHeader("Content-Type", "text/plain");
  res.send(formats[style] || formats.short);
};
