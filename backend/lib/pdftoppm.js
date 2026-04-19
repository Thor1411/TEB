import { spawn } from 'child_process'

export const runPdftoppmPng = async ({ pdfPath, outputPrefix, timeoutMs }) => {
  // Never invoke via shell. `pdftoppm` is from poppler-utils.
  await new Promise((resolve, reject) => {
    const child = spawn('pdftoppm', ['-png', pdfPath, outputPrefix], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderr = ''
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
      if (stderr.length > 10_000) stderr = stderr.slice(-10_000)
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('pdftoppm timed out'))
    }, timeoutMs)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) return resolve()
      reject(new Error(`pdftoppm failed (code ${code}): ${stderr || 'unknown error'}`))
    })
  })
}
