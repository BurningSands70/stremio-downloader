const request = require('request')
const mime = require('mime-types')
const fs = require('fs')
const path = require('path')
const downloadDir = require('./downloadDir')
const filelist = require('./fileList')
const metaDir = require('./metaDir')
const ffmpeg = require('easy-ffmpeg')

const files = filelist.get()

files.forEach((el, ij) => {
	if (!el.finished)
		files[ij].error = true
})

filelist.set(files)

function saveFiles() {
	saveFilesTimer = null
	const waitFor = filelist.set(files)
	saveFilesTimer = setTimeout(saveFiles, 60 * 60 * 1000)
}

// no need to save on app start
let saveFilesTimer = setTimeout(saveFiles, 60 * 60 * 1000)

function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

function checkFilePath(origPath, filePath, nr) {
	filePath = filePath || origPath
	nr = nr || 0
	if (fs.existsSync(filePath)) {
		const parts = origPath.split('.')
		nr++
		parts[parts.length -2] = parts[parts.length -2] + ' (' + nr + ')'
		newFilePath = parts.join('.')
		return checkFilePath(origPath, newFilePath, nr)
	}
	return filePath
}

function decideFilename(name, url, contentType) {

	let isHls = false

	if (contentType && hlsTypes.includes(contentType.toLowerCase()))
		isHls = true

	const ext = isHls ? 'mp4' : mime.extension(contentType)

	let filename = url.split('/').pop()

	if ((filename || '').includes('?'))
		filename = filename.split('?')[0]

	if (!filename || filename.length < 4 || !filename.includes('.') || isHls) {
		if (contentType) {
			if (name)
				return name + '.' + ext
			else
				return 'Unknown.' + ext
		} else
			return false
	} else
		return filename

}

const hlsTypes = [
	'video/m3u',
	'video/m3u8',
	'video/hls',
	'application/x-mpegurl',
	'vnd.apple.mpegURL',
	'video/mp2t',
	'application/vnd.apple.mpegurl'
]

function getMeta(url, metaUrl, metaId, metaType) {
	request.get(metaUrl, (err, resp, body) => {
		if (!err && body)
			metaDir.setMeta(metaId, metaType, body)
	})
}

const download = {
	list: () => {
		return clone(files).map(file => {
			file.progress = Math.floor((file.current/file.total) * 100)
			delete file.current
			return file
		}).reverse()
	},
	get: (name, url, streamId, filenameCb, metaUrl, metaId, metaType) => {
		request.head(url, function(err, res, body){

			if (!(res || {}).headers) {
				filenameCb(false)
				return
			}

			const total = res.headers['content-length']
			const type = res.headers['content-type']

			files.some((el, ij) => {
				if (el.url == url) {
					const waitFor = download.remove(null, url)
					return true
				}
			})

			const filename = decideFilename(name, url, type)

			if (!filename) {
				filenameCb(false)
				return
			}

			filenameCb(filename)

			const downDir = downloadDir.get()

			let filePath = path.join(downDir, filename)

			filePath = checkFilePath(filePath)

			if (type && hlsTypes.includes(type.toLowerCase())) {

				// ffmpeg -i "http://example.com/video_url.m3u8" -c copy -bsf:a aac_adtstoasc "output.mp4"

				const args = [
					'-c copy',
					'-bsf:a aac_adtstoasc'
				]

				const command = ffmpeg({ source: url, timeout: false })

				command.on('start', (commandLine) => {
					console.log('Spawned Ffmpeg with command: ', commandLine);
				}).on('error', (err) => {
					const idx = download.findIdx(url)
					if (idx > -1 && !files[idx].stopped)
						files[idx].error = true
				}).on('close', (err, msg) => {
					const idx = download.findIdx(url)
					if (idx > -1 && err && !files[idx].stopped)
						files[idx].error = true
				}).on('exit', (err, msg) => {
					const idx = download.findIdx(url)
					if (idx > -1 && err && !files[idx].stopped)
						files[idx].error = true
				})
				.on('end', (err, stdout, stderr) => {
					const idx = download.findIdx(url)
					if (idx > -1) {
						files[idx].finished = true
						const stats = fs.statSync(files[idx].filePath)
						files[idx].total = (stats || {}).size || 0
					}
				})

				command.outputOptions(args)

				command.save(filePath)

				files.push({
					filename,
					url,
					type,
					streamId,
					total: 0,
					current: 0,
					isHls: true,
					time: Date.now(),
					filePath,
					error: false,
					finished: false,
					stopped: false,
					meta: { url: metaUrl, type: metaType, id: metaId },
					getCommand: () => { return command }
				})

			} else {

				const req = request(url)

				files.push({
					filename,
					url,
					type,
					streamId,
					total,
					current: 0,
					time: Date.now(),
					filePath,
					error: false,
					finished: false,
					stopped: false,
					meta: { url: metaUrl, type: metaType, id: metaId },
					getReq: () => { return req }
				})

				req.pipe(fs.createWriteStream(filePath)).on('close', () => {
					const idx = download.findIdx(url)
					if (idx > -1) {
						if (files[idx].current < files[idx].total && !files[idx].stopped)
							files[idx].error = true
						else if (!files[idx].stopped)
							files[idx].finished = true
					}
				})

				req.on('data', chunk => {
					const idx = download.findIdx(url)
					if (idx > -1)
						files[idx].current += chunk.length
				})

				req.on('error', err => {
					const idx = download.findIdx(url)
					if (idx > -1 && !files[idx].stopped)
						files[idx].error = true
				})
			}
			if (metaUrl)
				getMeta(url, metaUrl, metaId, metaType)
		})
	},
	remove: (filename, url) => {
		let file
		let meta = {}
		files.some((el, ij) => {
			if (el.url == url) {
				file = el
				meta = JSON.parse(JSON.stringify(file.meta))
				if (file.getReq) {
					const req = file.getReq()
					if (req) req.abort()
				}
				if (file.getCommand) {
					const command = file.getCommand()
					if ((command || {}).kill)
						command.kill('SIGINT')
				}
				files.splice(ij, 1)
				return true
			}
		})

		if (file) {
			try {
				fs.unlinkSync(file.filePath)
			} catch(e) {}
		}

		if (meta.id && meta.type) {
			const keepMeta = files.some(el => {
				if (el.meta.id == meta.id && el.meta.type == meta.type)
					return true
			})
			if (!keepMeta)
				metaDir.removeMeta(meta.id, meta.type)
		}
		return true
	},
	stop: (filename, url) => {
		let file
		files.some((el, ij) => {
			if (el.url == url) {
				file = el
				if (file.getReq) {
					const req = file.getReq()
					if (req) req.abort()
				}
				if (file.getCommand) {
					const command = file.getCommand()
					if ((command || {}).kill)
						command.kill('SIGINT')
				}
				files[ij].stopped = true
				return true
			}
		})
	},
	find: (url) => {
		let file
		files.some((el, ij) => {
			if (el.url == url) {
				file = el
				return true
			}
		})
		return file
	},
	findIdx: (url) => {
		let idx = -1
		files.some((el, ij) => {
			if (el.url == url) {
				idx = ij
				return true
			}
		})
		return idx
	},
	findById: (id, type) => {
		const fls = []
		files.some((el, ij) => {
			if (el.streamId == id && (el.meta || {}).type == type)
				fls.push(el)
		})
		return fls
	},
	cleanEnd: cb => {
		if (saveFilesTimer)
			clearTimeout(saveFilesTimer)
		filelist.set(files)
		cb()
	}
}

module.exports = download
