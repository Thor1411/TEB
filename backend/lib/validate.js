import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import { dockerAvailable, runInDockerSandbox } from './sandbox.js'

const run = async (cmd, args, { timeoutMs } = {}) => {
  await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })

    let stderr = ''
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000)
    })

    const timer = timeoutMs ? setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${cmd} timed out`))
    }, timeoutMs) : null

    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      if (code === 0) return resolve()
      reject(new Error(`${cmd} failed (code ${code}): ${stderr || 'unknown error'}`))
    })
  })
}

export const validatePdfWithQpdf = async ({ pdfBytes, workDir, timeoutMs = 20_000 }) => {
  const jobId = crypto.randomUUID()
  const jobDir = path.join(workDir, `qpdf-${jobId}`)
  await fs.mkdir(jobDir, { recursive: true })

  const inputPath = path.join(jobDir, 'input.pdf')
  try {
    await fs.writeFile(inputPath, Buffer.from(pdfBytes))

    const useDocker = (process.env.SANDBOX_DOCKER || '1') !== '0'
    const hasDocker = useDocker ? await dockerAvailable() : false

    // `--check` validates xref tables/streams and general structure.
    // `--warning-exit-0` keeps warnings from failing the check.
    if (hasDocker) {
      const image = process.env.SANDBOX_IMAGE || 'secure-pdf-sanitizer:latest'
      try {
        await runInDockerSandbox({
          image,
          workDir: jobDir,
          cmd: 'qpdf',
          args: ['--check', '--warning-exit-0', 'input.pdf'],
          timeoutMs
        })
      } catch {
        await run('qpdf', ['--check', '--warning-exit-0', inputPath], { timeoutMs })
      }
    } else {
      await run('qpdf', ['--check', '--warning-exit-0', inputPath], { timeoutMs })
    }
    return { ok: true }
  } catch (e) {
    const requireQpdf = (process.env.REQUIRE_QPDF || '0') === '1'
    const isMissingBinary = e?.code === 'ENOENT' || /\bENOENT\b/.test(String(e?.message || ''))
    if (!requireQpdf && isMissingBinary) {
      return { ok: true, skipped: true, warning: 'qpdf not installed; structural validation skipped' }
    }
    return { ok: false, error: e.message }
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {})
  }
}
