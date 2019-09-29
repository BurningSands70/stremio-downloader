const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const configDir = require('./userDir')

module.exports = {
	get: () => {
		const userSettingsPath = path.join(configDir, 'file-list.json')

		let filelist = []

		if (fs.existsSync(userSettingsPath)) {
			let fileData = fs.readFileSync(userSettingsPath, 'utf8')
			fileData = Buffer.isBuffer(fileData) ? fileData.toString() : fileData
			let obj
			try {
				obj = JSON.parse(fileData)
			} catch(e) {

			}

			if ((obj || {}).filelist)
				filelist = obj.filelist
		}

		return filelist
	},
	set: filelist => {
		const userSettingsPath = path.join(configDir, 'file-list.json')

		fs.writeFileSync(userSettingsPath, JSON.stringify({ filelist }))

		return true
	}
}