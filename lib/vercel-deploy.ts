const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID

type DeploymentState = 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' | null

export async function getDeploymentByBranch(
  branch: string,
): Promise<{ state: DeploymentState; url: string | null }> {
  const teamParam = VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : ''
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&meta-githubCommitRef=${encodeURIComponent(branch)}&limit=1${teamParam}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  )

  if (!res.ok) return { state: null, url: null }

  const data = await res.json()
  const deployment = data.deployments?.[0]

  if (!deployment) return { state: null, url: null }

  return {
    state: deployment.state as DeploymentState,
    url: deployment.state === 'READY' ? `https://${deployment.url}` : null,
  }
}
