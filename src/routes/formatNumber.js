export default (req, res) => {
  const value = parseInt(req.query.value);
  if (isNaN(value)) return res.send("❌ Use ?value=numero");

  let result;
  if (value >= 1_000_000_000) result = (value / 1_000_000_000).toFixed(1) + "B";
  else if (value >= 1_000_000) result = (value / 1_000_000).toFixed(1) + "M";
  else if (value >= 1_000) result = (value / 1_000).toFixed(1) + "K";
  else result = value.toString();

  res.setHeader("Content-Type", "text/plain");
  res.send(result);
};
