const repository = 'WernerRall147/H2OChallenge'
const endpoint = `https://api.github.com/repos/${repository}/pages`
const token = process.env.GH_TOKEN

async function request(method, body) {
  return fetch(endpoint, {
    method,
    redirect: 'error',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: ['Bearer', token].join(' '),
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

function check(response, operation) {
  if (!response.ok) {
    throw new Error(
      `${operation} failed (HTTP ${response.status}). Check repository access, token permissions, and Pages availability for your plan or organization.`,
    )
  }
}

try {
  if (!token) {
    throw new Error(
      'Set GH_TOKEN to an administrator-authorized token with repository Pages and Administration write permissions. The Actions GITHUB_TOKEN cannot enable Pages.',
    )
  }

  const current = await request('GET')
  if (current.status === 404) {
    check(await request('POST', { build_type: 'workflow' }), 'Create Pages site')
  } else {
    check(current, 'Read Pages configuration')
    if ((await current.json()).build_type !== 'workflow') {
      check(await request('PUT', { build_type: 'workflow' }), 'Update Pages source')
    }
  }

  const verified = await request('GET')
  check(verified, 'Verify Pages configuration')
  const site = await verified.json()
  if (site.build_type !== 'workflow') {
    throw new Error('Pages is not configured to use GitHub Actions.')
  }

  console.log(`GitHub Pages is enabled for ${repository} with GitHub Actions as the source.`)
  console.log('Run the Deploy to GitHub Pages workflow on main to publish the app.')
} catch (error) {
  console.error(`Unable to enable GitHub Pages: ${error.message}`)
  process.exitCode = 1
}
