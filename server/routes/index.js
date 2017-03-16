import express from 'express'
import path from 'path'

const router = express.Router()

router.use('/', express.static(path.join(__dirname, '../../build/')))
router.use('/', express.static(path.join(__dirname, '../../build/icons/'), { maxAge: 365 * 24 * 60 * 60 * 1000 }))
router.use('/', express.static(path.join(__dirname, '../../static'), { maxAge: 365 * 24 * 60 * 60 * 1000 }))

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../build/document/index.html'))
})

module.exports = router
