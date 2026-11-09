import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)
const whisperDir = path.resolve('data', 'whisper')
const venvDir = path.join(whisperDir, 'venv')
const venvPython = path.join(venvDir, process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python')

async function findPython() {
  const candidates = [process.env.PYTHON, 'python', 'python3'].filter(Boolean) as string[]
  let lastError: unknown
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['--version'])
      return candidate
    } catch (error) { lastError = error }
  }
  throw lastError
}

export async function ensureWhisperInstalled() {
  if (process.env.WHISPER_AUTO_INSTALL === 'false' || process.env.LOCAL_WHISPER_EXECUTABLE) return
  try {
    try {
      await execFileAsync(venvPython, ['-c', 'import faster_whisper'])
    } catch {
      console.log('Установка локального Whisper (faster-whisper)…')
      const python = await findPython()
      await execFileAsync(python, ['-m', 'venv', venvDir])
      await execFileAsync(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'])
      await execFileAsync(venvPython, ['-m', 'pip', 'install', 'faster-whisper'])
      await execFileAsync(venvPython, ['-c', 'import faster_whisper'])
      console.log('Локальный Whisper установлен')
    }
    process.env.LOCAL_WHISPER_EXECUTABLE = venvPython
    process.env.LOCAL_WHISPER_RUNNER = 'faster'
    process.env.LOCAL_WHISPER_MODEL ||= 'base'
  } catch (error) {
    console.error('Не удалось установить локальный Whisper. Приложение продолжит запуск; можно настроить OPENAI_API_KEY.', error)
  }
}
