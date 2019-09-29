const express = require('express')
const getPort = require('get-port')
const path = require('path')
const proxy = require('./proxy')
const api = require('./api')
const downloadDir = require('./downloadDir')
const tokenApi = require('./tokenDir')
const addonApi = require('./addon')

async function init(cb) {

	const router = express()

	proxy.createProxyServer(router)

	router.use('/assets', express.static(path.join(__dirname, '..', 'assets')))

	router.use('/downloader', express.static(path.join(__dirname, '..', 'downloader')))

	router.use('/api', api.router)

	const token = tokenApi.get()

	router.use('/files-'+token, express.static(downloadDir.get()))

	router.use('/addon-'+token, addonApi.handler)

	const serverPort = await getPort({ port: 8189 })

	const server = router.listen(serverPort, () => {

		const url = 'http://127.0.0.1:' + serverPort

		proxy.setEndpoint(url)

		api.setEndpoint(url)

		addonApi.setEndpoint(url + '/files-' + token)

		proxy.addProxy('http://app.strem.io/shell-v4.4/#/')

		const downloaderUrl = url + '/downloader/'

		console.log('Stremio Downloader server running at: ' + downloaderUrl)

		cb(url)

	})

}

module.exports = init
