const fs = require('fs')
const { join } = require('path')
const express = require('express')
const app = express()
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const { execFile } = require('child_process')

const storage = multer.diskStorage({
  destination (req, file, cb) {
    const id = req.body.uuidv4
    const directory = `uploads/${id}`
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory)
    }
    cb(null, directory)
  },
  filename (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1000 // 10 KB
  },
  fileFilter (req, file, cb) {
    const fileExtention = /(cpp|h|hpp)$/
    // console.log(file)
    if (file.mimetype !== 'text/plain') {
      const message = '不正なファイルです。'
      // console.log(message)
      cb(new Error(message))
    } else if (!fileExtention.test(file.originalname)) {
      const message = '不正なファイルです。'
      // console.log(message)
      cb(new Error(message))
    }
    cb(null, true)
  }
})

const rmdir = (directoryName) => {
  fs.rmdir(directoryName, { recursive: true }, err => {
    if (err) console.error(err)
  })
}

app.set('port', process.env.PORT || 3002)
app.listen(app.get('port'), () => {
  console.log(`http://localhost:${app.get('port')}`)
})

app.get('/uuid', (req, res) => {
  res.send(uuidv4())
})

app.get('/', (req, res) => res.sendFile(join(__dirname, 'public/upload.html')))

app.post('/run', (req, res) => {
  upload.array('codes')(req, res, (err) => {
    // multer.diskStorage にも req に対しての処理がある
    const id = req.body.uuidv4
    const runDirectory = join(__dirname, 'uploads', id)

    if (err instanceof multer.MulterError) {
      console.dir(err)
      res.status(500)

      if (err.code === 'LIMIT_FILE_SIZE') {
        err.message = 'ファイルサイズが大きいです！' // 'File too large'
        res.send(err.message)
      } else {
        res.send(err.message)
      }

      rmdir(runDirectory)

      return
    } else if (err) {
      console.error(err)

      res.status(500)
      res.send(err.message)
      rmdir(runDirectory)

      return
    }

    // ファイル名のみを docker の引数に渡すように
    const regId = new RegExp('uploads/' + id + '/')
    const files = req.files.map(value => value.path.replace(regId, ''))
    // console.log(files)

    const argFiles = files.join(' ')
    const runCommand = `run -v ${runDirectory}:/gtest --rm gtest_runner ${argFiles}`
    // console.log(runCommand)

    execFile('docker', runCommand.split(' '), (err, stdout, stderr) => {
      const response = stdout + stderr
      console.log(response)
      res.send(response)
      rmdir(runDirectory)
    })
  })
})
// app.post('/upload', upload.array('code'), (req, res) => {
//   res.send('uppi!')
// })
