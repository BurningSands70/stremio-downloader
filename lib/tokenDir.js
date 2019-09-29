const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const nanoid = require('nanoid')
const configDir = require('./userDir')

const tokenApi = {
	get: () => {

		const userSettingsPath = path.join(configDir, 'user-token.json')

		let downloadToken

		if (fs.existsSync(userSettingsPath)) {
			let fileData = fs.readFileSync(userSettingsPath, 'utf8')
			fileData = Buffer.isBuffer(fileData) ? fileData.toString() : fileData
			let obj
			try {
				obj = JSON.parse(fileData)
			} catch(e) {

			}

			if ((obj || {}).token)
				downloadToken = obj.token
		}

		if (!downloadToken) {
			downloadToken = nanoid()
			tokenApi.set(downloadToken)
		}

		return downloadToken
	},
	set: token => {
		const userSettingsPath = path.join(configDir, 'user-token.json')

		fs.writeFileSync(userSettingsPath, JSON.stringify({ token }))
	}
}

module.exports = tokenApi
