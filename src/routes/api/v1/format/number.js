export default (req, res) => {
  const { value, style = "short", mode = "txt" } = req.query;
  if (!value) {
    res.setHeader("Content-Type", "text/plain");
    return res.send("value obrigatório");
  }

  const suffix = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15 };
  const rgx = /^([\d.,]+)\s*([KMBTQ])$/i;
  const match = String(value).toUpperCase().match(rgx);

  let num = match
    ? parseFloat(match[1].replace(",", ".")) * suffix[match[2]]
    : parseFloat(String(value).replace(",", "."));

  if (isNaN(num)) {
    res.setHeader("Content-Type", "text/plain");
    return res.send("valor inválido");
  }

  const abs = Math.abs(num);
  const formats = {
    short: abs >= 1e15 ? (num / 1e15).toFixed(1) + "Q"
      : abs >= 1e12 ? (num / 1e12).toFixed(1) + "T"
      : abs >= 1e9 ? (num / 1e9).toFixed(1) + "B"
      : abs >= 1e6 ? (num / 1e6).toFixed(1) + "M"
      : abs >= 1e3 ? (num / 1e3).toFixed(1) + "K"
      : num.toString(),

    long: abs >= 1e15 ? (num / 1e15).toFixed(1) + " quatrilhão"
      : abs >= 1e12 ? (num / 1e12).toFixed(1) + " trilhão"
      : abs >= 1e9 ? (num / 1e9).toFixed(1) + " bilhão"
      : abs >= 1e6 ? (num / 1e6).toFixed(1) + " milhão"
      : abs >= 1e3 ? (num / 1e3).toFixed(1) + " mil"
      : num.toString(),

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
      return n === 0 ? "0º" : n + "º";
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

  if (mode === "json") {
    res.setHeader("Content-Type", "application/json");
    return res.json({ input: value, number: num, ...formats });
  }

  res.setHeader("Content-Type", "text/plain");
  res.send(formats[style] || formats.short);
};
