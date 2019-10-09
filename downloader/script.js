
function request(method, url, filename, cb) {
	cb = cb || (() => {})
	$.get('/api?method=' + method + (url ? ('&url=' + encodeURIComponent(url)) : '') + (filename ? ('&filename=' + encodeURIComponent(filename)) : ''), cb)
}

function fileToRow(file, idx) {
	let str = '' +
	'<tr>' +
		'<td class="name">' + file.filename + '</td>' +
		'<td class="desc">' + (file.error ? 'Error' : file.finished ? 'Finished' : file.stopped ? 'Stopped' : file.isHls ? 'Downloading' : file.progress + '%')+'</td>' +
		'<td class="actions">'

	str += '' +
		'<button class="mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab" onClick="apiCall(\'remove-download\', \''+file.url+'\', \''+encodeURIComponent(file.filename).replace(/'/g, "%27")+'\')">' +
			'<i class="material-icons">delete</i>' +
		'</button>'

	if (file.error || file.stopped) {
		str += '' +
			'<button class="mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab" style="margin-left: 14px; margin-right: 0" onClick="apiCall(\'restart-download\', \''+file.url+'\', \''+encodeURIComponent(file.filename).replace(/'/g, "%27")+'\')">' +
				'<i class="material-icons">refresh</i>' +
			'</button>'
	} else if (file.finished) {
		str += '' +
			'<button class="mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab" style="margin-left: 14px; margin-right: 0" onClick="fileOptions(\''+file.url+'\', \''+encodeURIComponent(file.filename).replace(/'/g, "%27")+'\')">' +
				'<i class="material-icons">menu</i>' +
			'</button>'
	} else {
		str += '' +
			'<button class="mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab" style="margin-left: 14px; margin-right: 0" onClick="apiCall(\'stop-download\', \''+file.url+'\', \''+encodeURIComponent(file.filename).replace(/'/g, "%27")+'\')">' +
				'<i class="material-icons">stop</i>' +
			'</button>'
	}

	str += '' +
		'</td>' +
	'</tr>'

	return str
}

function options(url) {
	let str = '<div>' +
		'<button class="mdl-button mdl-js-button mdl-button--raised" onClick="apiCall(\'open-folder\')">' +
			'Open Download Folder' +
		'</button>' +
		'<button class="mdl-button mdl-js-button mdl-button--raised" style="margin-top: 12px" onClick="apiCall(\'change-folder\')">' +
			'Change Download Folder' +
		'</button>' +
		'<button class="mdl-button mdl-js-button mdl-button--raised" style="margin-top: 12px" onClick="apiCall(\'install-addon\')">' +
			'Install Downloader as Add-on' +
		'</button>' +
		'<button class="mdl-button mdl-js-button mdl-button--raised" style="margin-top: 12px" onClick="closeDialog()">Close</button>'+
	'</div>'
	$('.mdl-dialog').html(str)
	componentHandler.upgradeAllRegistered()
	dialog.showModal()
	setTimeout(() => {
		document.activeElement.blur()
	})
}

function fileOptions(url, filename) {
	let str = '<div>' +
		'<button class="mdl-button mdl-js-button mdl-button--raised" onClick="apiCall(\'open-location\',\''+url+'\', \''+filename+'\')">' +
			'Open File Location' +
		'</button>' +
		'<button class="mdl-button mdl-js-button mdl-button--raised" style="margin-top: 12px" onClick="apiCall(\'play-video\',\''+url+'\', \''+filename+'\')">' +
			'Play Video' +
		'</button>' +
		'<button class="mdl-button mdl-js-button mdl-button--raised" style="margin-top: 12px" onClick="closeDialog()">Close</button>'+
	'</div>'
	$('.mdl-dialog').html(str)
	componentHandler.upgradeAllRegistered()
	dialog.showModal()
	setTimeout(() => {
		document.activeElement.blur()
	})
}

function search(cb) {
	setTimeout(() => {
		const query = $('#query').val()
		const results = []
		let files
		try {
			files = JSON.parse(localFiles)
		} catch(e) {
			files = []
		}
		files.forEach(el => {
			if (includes(el.filename, query))
				results.push(el)
		})
		if (results.length) {
			let str = ''
			results.forEach((el, ij) => {
				str += fileToRow(el, ij)
			})
			$('#downloads').html(str)
		} else
			$('#downloads').empty()
		if (cb) cb()
	})
}

let dialog

let localFiles = '[]'

function includes(str, str2) {
	return str.split('.').join(' ').toLowerCase().includes(str2.toLowerCase())
}

$(document).ready(() => {

	dialog = document.querySelector('dialog')

	dialogPolyfill.registerDialog(dialog)

	$('#query').keydown(evt => {
		evt = evt || window.event
		if (evt == 13) {
			event.preventDefault();
			return false;
		}
		search()
	})

	function update() {

		request('files', null, null, files => {
			if (localFiles == files) {
				if (localFiles == '[]')
					$('#no-downloads').fadeIn()
				return
			}

			localFiles = files

			try { files = JSON.parse(files) } catch(e) { files = [] }

			let str = ''

			const query = $('#query').val()

			if ((query || '').length)
				files = files.filter(el => includes(el.filename, query))

			files.forEach((el, idx) => { str += fileToRow(el, idx) })

			if (!files.length) {
				if ($('#no-downloads').css('display') == 'none')
					$('#no-downloads').fadeIn()
				$('#downloads').html('')
			} else {
				if ($('#no-downloads').css('display') == 'block')
					$('#no-downloads').css('display', 'none')
				$('#downloads').html(str)
			}

		})

		setTimeout(update, 2000)
	}

	update()


	function checkEngine() {

		$.ajax({
			url: 'http://127.0.0.1:11470/settings',
			type: 'GET',
			success: data => {
				if ($('#no-engine').css('display') == 'block')
					$('#no-engine').css('display', 'none')
			},
			error: data => {
				if ($('#no-engine').css('display') == 'none')
					$('#no-engine').fadeIn()
			}
		})

		setTimeout(checkEngine, 5000)
	}

	checkEngine()
})

function apiCall(method, url, filename) {
	filename = decodeURIComponent(filename)
	request(method, url, filename)
	closeDialog()	
}

function closeDialog() { dialog.close() }
