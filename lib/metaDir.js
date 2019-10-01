const fs = require('fs')
const path = require('path')
const async = require('async')
const { app } = require('electron')
const configDir = app.getPath('userData')

const metaDir = {
    getFolder: () => {

        const configDir = app.getPath('userData')

        const userSettingsPath = path.join(configDir, 'metas')

        if (!fs.existsSync(userSettingsPath))
            fs.mkdirSync(userSettingsPath)

        return userSettingsPath

        let downloadFolder

        if (fs.existsSync(userSettingsPath)) {
            let fileData = fs.readFileSync(userSettingsPath, 'utf8')
            fileData = Buffer.isBuffer(fileData) ? fileData.toString() : fileData
            let obj
            try {
                obj = JSON.parse(fileData)
            } catch(e) {

            }

            if ((obj || {}).folder)
                downloadFolder = obj.folder
        }

        if (!downloadFolder)
            downloadFolder = tempDir

        return downloadFolder
    },
    getMeta: (id, type) => {
        const folder = metaDir.getFolder()
        const typeDir = path.join(folder, type)

        if (!fs.existsSync(typeDir))
            fs.mkdirSync(typeDir)

        const toMetaDir = path.join(typeDir, id + '.json')

        let metaData

        if (fs.existsSync(toMetaDir)) {
            let fileData = fs.readFileSync(toMetaDir, 'utf8')
            fileData = Buffer.isBuffer(fileData) ? fileData.toString() : fileData
            let obj
            try {
                obj = JSON.parse(fileData)
            } catch(e) {

            }

            if ((obj || {}).meta)
                metaData = obj
        }

        return metaData
    },
    setMeta: (id, type, data) => {
        const folder = metaDir.getFolder()
        const typeDir = path.join(folder, type)

        if (!fs.existsSync(typeDir))
            fs.mkdirSync(typeDir)

        const toMetaDir = path.join(typeDir, id + '.json')

        fs.writeFileSync(toMetaDir, data)
    },
    removeMeta: (id, type) => {
        const folder = metaDir.getFolder()
        const typeDir = path.join(folder, type)

        if (!fs.existsSync(typeDir))
            fs.mkdirSync(typeDir)

        const toMetaDir = path.join(typeDir, id + '.json')

        if (fs.existsSync(toMetaDir))
            fs.unlinkSync(toMetaDir)
    },
    getAll: (type, cb) => {
        const folder = metaDir.getFolder()
        const typeDir = path.join(folder, type)

        if (!fs.existsSync(typeDir))
            fs.mkdirSync(typeDir)

        const catalog = []

        const q = async.queue((task, cb) => {
            let obj
            if ((task || {}).id)
                obj = metaDir.getMeta(task.id, type)
            if ((obj || {}).meta)
                catalog.push(obj.meta)
            cb()
        }, 1)

        q.drain(() => {
            cb(catalog)
        })

        fs.readdir(typeDir, (err, files) => {
            if (err || !(files.length)) {
                cb([])
            } else {
                let addedOne = false
                files.forEach(file => {
                    if (file.endsWith('.json')) {
                        addedOne = true
                        q.push({ id: file.replace('.json', '') })
                    }
                })
                if (!addedOne)
                    cb([])
            }
        })
    }
}

module.exports = metaDir
