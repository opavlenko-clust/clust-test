const BASE_URL = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`

const headers = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
}

async function getMainSha(): Promise<string> {
  const res = await fetch(`${BASE_URL}/git/ref/heads/main`, { headers })
  const data = await res.json()
  return data.object.sha
}

export async function createBranch(branch: string): Promise<void> {
  const sha = await getMainSha()
  const res = await fetch(`${BASE_URL}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Failed to create branch: ${JSON.stringify(err)}`)
  }
}

async function getFileSha(path: string, branch: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/contents/${path}?ref=${branch}`, { headers })
  if (!res.ok) return null
  const data = await res.json()
  return data.sha ?? null
}

export async function upsertFile(
  path: string,
  content: string,
  branch: string,
  message: string,
): Promise<void> {
  const sha = await getFileSha(path, branch)
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
  }
  if (sha) body.sha = sha

  const res = await fetch(`${BASE_URL}/contents/${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Failed to upsert ${path}: ${JSON.stringify(err)}`)
  }
}

export async function deleteFile(
  path: string,
  branch: string,
  message: string,
): Promise<void> {
  const sha = await getFileSha(path, branch)
  if (!sha) return

  await fetch(`${BASE_URL}/contents/${path}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ message, sha, branch }),
  })
}

export async function deleteBranch(branch: string): Promise<void> {
  await fetch(`${BASE_URL}/git/refs/heads/${branch}`, {
    method: 'DELETE',
    headers,
  })
}

export async function mergeBranch(branch: string, message: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/merges`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base: 'main', head: branch, commit_message: message }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Failed to merge: ${JSON.stringify(err)}`)
  }
}
