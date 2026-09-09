const http = require("http");

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const location = `https://littleoni.fun${req.url}`;

  res.writeHead(301, {
    Location: location,
    "Cache-Control": "no-store",
  });

  res.end();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Redirect server listening on ${port}`);
});
