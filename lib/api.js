const download = require('./download')
const { shell, dialog } = require('electron')
const events = require('./events')
const downloadDir = require('./downloadDir')
const tokenApi = require('./tokenDir')

let endpoint

module.exports = {
	setEndpoint: str => {
		endpoint = str
	},
	router: (req, res) => {
		const parsed = require('url').parse(req.url, true)
		const query = (parsed || {}).query || {}
		if (query.method == 'add-download') {
			if (query.url) {
				let url = query.url
				if (url.startsWith('http://127.0.0.1:11470/')) {
					if (url.endsWith('/hls.m3u8'))
						url = url.replace('/hls.m3u8', '/')
				}
				download.get(query.title, url, query.streamId, filename => {
					if (filename) {
						res.statusCode = 200
						res.end(filename)
					} else {
						res.statusCode = 500
						res.end('error')
					}
				}, query.metaUrl, query.metaId, query.metaType)
			} else {
				res.statusCode = 500
		        res.end('error')
			}
		} else if (query.method == 'remove-download') {
			if (query.url && query.filename) {
				download.remove(query.filename, query.url)
				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}
		} else if (query.method == 'load-stremio') {
			shell.openExternal(endpoint + '/web/app.strem.io/shell-v4.4/')
			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))
		} else if (query.method == 'focus-window') {
			events.emit('focus-window')
			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))
		} else if (query.method == 'open-folder') {

			const downDir = downloadDir.get()

			shell.openItem(downDir)

			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))			

		} else if (query.method == 'change-folder') {

			let options = {
				properties: ['openDirectory']
			}

			dialog.showOpenDialog(options, dir => {
				downloadDir.set((dir || [])[0])
			})

			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))

		} else if (query.method == 'play-video') {
			if (query.url) {
				const file = download.find(query.url)

				shell.openItem(file.filePath)

				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}
		} else if (query.method == 'open-location') {

			if (query.url) {
				const file = download.find(query.url)

				shell.showItemInFolder(file.filePath)

				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}			

		} else if (query.method == 'restart-download') {

			if (query.url) {
				const file = download.find(query.url)

				let name = file.filename.split('.')

				name.pop()

				name = name.join('.')

				download.get(name, file.url, file.streamId, () => {}, file.meta.url, file.meta.id, file.meta.type)

				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}			

		} else if (query.method == 'stop-download') {

			if (query.url && query.filename) {
				download.stop(query.filename, query.url)
				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}			

		} else if (query.method == 'install-addon') {
			const addonUrl = endpoint.replace('http:', 'stremio:') + '/addon-' + tokenApi.get() + '/manifest.json'
			shell.openExternal(addonUrl)
			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))
		} else if (query.method == 'files') {
			res.statusCode = 200
			res.end(JSON.stringify(download.list()))
		} else {
			res.statusCode = 500
	        res.end('error')
		}
	}
}
