const metaDir = require('./metaDir')
const download = require('./download')

const manifest = {
	id: 'org.stremio.downloader',
	name: 'Stremio Downloader',
	version: '1.0.0',
	description: 'Downloader add-on for Stremio',
	resources: ['catalog', 'meta', 'stream'],
	types: ['movie', 'series', 'channel', 'tv'],
	catalogs: [
		{
			type: 'movie',
			id: 'downloader-movie',
			name: 'Downloaded Movies'
		},
		{
			type: 'series',
			id: 'downloader-series',
			name: 'Downloaded Series'
		},
		{
			type: 'channel',
			id: 'downloader-channel',
			name: 'Downloaded Channels'
		},
		{
			type: 'tv',
			id: 'downloader-tv',
			name: 'Downloaded TV'
		}
	]
}

function getArgs(url) {
	let urlParts = url.split('/')
	const args = {}
	args.id = urlParts.pop()
	args.id = decodeURIComponent(args.id.replace('.json', ''))
	args.type = urlParts.pop()
	args.method = urlParts.pop()
	return args
}

function fileToStream(file) {
	const filename = file.filePath.split('/').pop()
	return {
		title: filename,
		url: endpoint + '/' + filename
	}
}

let endpoint = ''

module.exports = {
	setEndpoint: str => {
		endpoint = str
		let addonLogo = endpoint.split('/')
		addonLogo.pop()
		addonLogo = addonLogo.join('/') + '/assets/addonLogo.png'
		manifest.logo = addonLogo
	},
	handler: (req, res, next) => {
		function fail() {
			res.statusCode = 500
			res.end('error')
		}
		function success(str) {
			res.statusCode = 200
			res.setHeader('Access-Control-Allow-Origin', '*')
			res.setHeader('Content-Type', 'application/json; charset=utf-8')
			res.end(JSON.stringify(str))
		}
		const isManifest = !!(req.url.split('/').pop() == 'manifest.json')
		const args = isManifest ? {} : getArgs(req.url)
		if (isManifest) {
			success(manifest)
		} else if (args.method == 'meta') {
			const meta = metaDir.getMeta(args.id, args.type)
			if (meta)
				success(meta)
			else fail()
		} else if (args.method == 'stream') {
			const fls = download.findById(args.id, args.type)
			if ((fls || []).length) {
				const files = JSON.parse(JSON.stringify(fls))
				success({ streams: files.filter(el => !!el.finished).map(fileToStream) })
			} else fail()
		} else if (args.method == 'catalog') {
			metaDir.getAll(args.type, catalog => {
				if ((catalog || []).length) 
					success({ metas: catalog })
				else 
					success({ metas: [] })
			})
		} else {
			fail()
		}
	}
}