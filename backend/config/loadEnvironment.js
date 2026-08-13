const path = require('node:path')
const { loadEnvFile } = require('node:process')

function loadEnvironment(filePath = path.join(__dirname, '..', '.env')) {
  try {
    loadEnvFile(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

module.exports = loadEnvironment
