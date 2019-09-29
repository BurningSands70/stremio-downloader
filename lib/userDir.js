const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const configDir = app.getPath('userData')

if (!fs.existsSync(configDir))
	fs.mkdirSync(configDir)

module.exports = configDir
