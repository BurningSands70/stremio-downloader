const httpProxy = require('http-proxy')
const fs = require('fs')
const path = require('path')
const httpsAgent = require('https').globalAgent
const pUrl = require('url')

const defaultAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/610.0.3239.132 Safari/537.36'

const proxies = {}

let endpoint

function getDirPath(path) {
    let dirPath

    if (path.includes('/'))
        dirPath = path.substr(0, path.lastIndexOf('/') + 1)

    return dirPath
}

var scriptElm = fs.readFileSync(path.join(__dirname, 'inject.html'))
var scriptElmHead = fs.readFileSync(path.join(__dirname, 'injectHead.html'))

function modifyHtml( str ) {
    // Add or script to the page
    if (str.indexOf('</body>') > -1 ) {
        str = str.replace( '</body>', scriptElm + '</body>' );
    } else if ( str.indexOf( '</html>' ) > -1 ){
        str = str.replace( '</html>', scriptElm + '</html>' );
    } else {
        str = str + scriptElm;
    }

    if (str.indexOf('<head>') > -1 ) {
        str = str.replace( '<head>', '<head>' + scriptElmHead );
    }

    return str;
}

const web_o = Object.values(require('http-proxy/lib/http-proxy/passes/web-outgoing'));

const proxify = {

    setEndpoint: url => {
        endpoint = url
    },

    getEndpoint: () => {
        return endpoint
    },

    addProxy: (url, opts) => {

        const urlParser = pUrl.parse(url)

        const host = urlParser.host

        const result = endpoint + '/web/' + urlParser.host + (urlParser.path || '')

        if (process.send) {
            // is child
            process.send({ proxy: true, url, opts })
            return result
        }

        const path = urlParser.path

        const dirPath = getDirPath(path)

        if (proxies && proxies[host]) {
            proxies[host].paths[path] = opts
            if (dirPath && !proxies[host].paths[dirPath])
                proxies[host].paths[dirPath] = opts
            return result
        }

        proxies[host] = {
            host,
            protocol: urlParser.protocol,
            opts,
            paths: {}
        }

        proxies[host].paths[path] = opts

        if (dirPath && !proxies[host].paths[dirPath])
            proxies[host].paths[dirPath] = opts

        return result
    },

    createProxyServer: router => {

        const proxy = httpProxy.createProxyServer({ selfHandleResponse: true })

        proxy.on('error', e => {
            if (e) {
                console.error('http proxy error')
                console.error(e)
            }            
        })

        proxy.on('proxyRes', (proxyRes, request, response) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*'
            for(var i=0; i < web_o.length; i++) {
              if(web_o[i](request, response, proxyRes, {})) { break; }
            }
            let body = []
            proxyRes.on('data', chunk => { body.push(chunk) })
//            if ((proxyRes.headers['content-type'] || '').match('text/html') || request.url.includes('/blob.css')) {
                proxyRes.on('end', () => {
                    body = Buffer.concat(body).toString()

                    // This disables chunked encoding
                    proxyRes.headers['transfer-encoding'] = ''

                    // Disable cache for all http as well
                    proxyRes.headers['cache-control'] = 'no-cache'

                    if ((proxyRes.headers['content-type'] || '').match('text/html')) {

                        if (proxyRes.headers['content-length'])
                            proxyRes.headers['content-length'] = body.length + scriptElm.length + scriptElmHead.length

                        response.end(modifyHtml(body))
                    } else if (request.url.includes('/blob.css')) {
                        body = body.split("url('fonts/").join("url('" + endpoint + "/assets/fonts/")
                        body = body.split('url("fonts/').join('url("' + endpoint + '/assets/fonts/')

                        if (proxyRes.headers['content-length'])
                            proxyRes.headers['content-length'] = body.length

                        response.end(body)
                    } else {
                        response.end(body)
                    }
                })
//            } else
//                proxyRes.pipe(response)

        })

        router.all('/web/*', (req, res) => {

            var parts = req.url.split('/')

            var host = parts[2]

            parts.splice(0, 3)

            req.url = '/'+parts.join('/')

            let configProxy = {}
            let opts = {}
            let config = {}

            if (proxies[host]) {
                config = proxies[host]

                configProxy = { target: config.protocol+'//'+config.host }

                configProxy.headers = {
                    host: config.host,
                    agent: defaultAgent,
                }

                req.headers['host'] = configProxy.headers.host
                req.headers['user-agent'] = configProxy.headers.agent

                if ((req.headers['accept-encoding'] || '').includes('gzip'))
                    req.headers['accept-encoding'] = 'deflate, br'

                opts = config.paths[req.url] || config.paths[getDirPath(req.url)] || config.opts || {}

                if (opts.headers)
                    for (let key in opts.headers)
                        configProxy.headers[key] = req.headers[key] = opts.headers[key]

                if (config.protocol == 'https:')
                    configProxy.agent = httpsAgent

                res.setHeader('Access-Control-Allow-Origin', '*')

            }

            if (!configProxy.target) {
                res.writeHead(500)
                res.end(JSON.stringify({ err: 'handler error' }))
            } else {
                proxy.web(req, res, configProxy)
            }

        })

    }
}

module.exports = proxify