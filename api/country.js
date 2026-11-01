// The visitor's country, from Vercel's own geo header (no outside service): the game shows Persian
// to visitors from Iran. Not served by serve.py, so locally the game goes by the time zone alone.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ country: req.headers["x-vercel-ip-country"] || null });
};
