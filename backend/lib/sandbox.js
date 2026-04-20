import { spawn } from 'child_process'

let cachedDockerAvailable = null
let cachedDockerAvailableAt = 0
const DOCKER_AVAILABLE_TTL_MS = Number(process.env.DOCKER_AVAILABLE_TTL_MS || 30_000)

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

export const dockerAvailable = async () => {
  // Respect explicit opt-out without probing.
  if ((process.env.SANDBOX_DOCKER || '1') === '0') return false

  const now = Date.now()
  if (cachedDockerAvailable !== null && (now - cachedDockerAvailableAt) < DOCKER_AVAILABLE_TTL_MS) {
    return cachedDockerAvailable
  }

  try {
    await run('docker', ['version'], { timeoutMs: 2000 })
    cachedDockerAvailable = true
    cachedDockerAvailableAt = now
    return cachedDockerAvailable
  } catch {
    cachedDockerAvailable = false
    cachedDockerAvailableAt = now
    return cachedDockerAvailable
  }
}

export const runInDockerSandbox = async ({
  image,
  workDir,
  cmd,
  args,
  timeoutMs,
  memory = process.env.SANDBOX_MEMORY || '512m',
  cpus = process.env.SANDBOX_CPUS || '1',
  pidsLimit = process.env.SANDBOX_PIDS || '128'
}) => {
  // Runs a command in an isolated container: no network, limited CPU/mem/pids.
  const dockerArgs = [
    'run', '--rm',
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt', 'no-new-privileges',
    '--pids-limit', String(pidsLimit),
    '--cpus', String(cpus),
    '--memory', String(memory),
    '-v', `${workDir}:/work:rw`,
    '-w', '/work',
    image,
    `${cmd} ${args.map(a => `'${String(a).replaceAll("'", "'\\''")}'`).join(' ')}`
  ]

  await run('docker', dockerArgs, { timeoutMs })
}
