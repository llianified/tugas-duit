import http from 'node:http'

const port = process.env.PORT || 3000
const productionOrigin = 'https://littleoni.fun'

const server = http.createServer((request, response) => {
  const location = `${productionOrigin}${request.url || '/'}`

  response.writeHead(301, {
    Location: location,
    'Cache-Control': 'no-store',
  })
  response.end()
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Legacy Render redirect listening on ${port}`)
})
