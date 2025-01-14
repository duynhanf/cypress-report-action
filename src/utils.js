const core = require('@actions/core')
const github = require('@actions/github')
const markdownTable = require('markdown-table')
const { createComment } = require('@aki77/actions-replace-comment')

function getExamples(results) {
  return getChildren(results, [])
}

function getChildren(input, output, filepath) {
  Object.values(input).forEach(({ tests, suites, file }) => {
    if (file) {
      filepath = file
    }

    if (tests) {
      tests.forEach(({ fail, pending, skipped, fullTitle, err: { message } }) => {
        if (fail || pending || skipped) {
          output.push({
            title: fullTitle,
            filepath,
            message: message ? message.replace(/\n+/g, ' ') : null,
            state: fail ? 'fail' : (skipped ? 'skipped' : 'pending')
          })
        }
      })
    }

    if (suites) {
      output = [...getChildren(suites, output, filepath)]
    }
  })

  return output
}

function getTable(examples) {
  return markdownTable([
    ['State', 'Description'],
    ...examples.map(({ state, filepath, title, message }) => [
      state,
      `**Filepath**: ${filepath}<br>**Title**: ${title}<br>**Error**: ${message}`
    ])
  ])
}

function getSummary(stats) {
  return `Passes: ${stats.passes},` +
    ` failures: ${stats.failures},` +
    ` pending: ${stats.pending},` +
    ` skipped: ${stats.skipped},` +
    ` other: ${stats.other}.`
}

function pullRequestId() {
  const pullRequestId = github.context.issue.number
  if (!pullRequestId) {
    throw new Error('Cannot find the pull request ID.')
  }
  return pullRequestId
}

const commentGeneralOptions = () => {
  const token = core.getInput('token', { required: true });
  return {
    token: token,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: pullRequestId()
  }
}

async function report(result) {
  const title = core.getInput('title', { required: true });
  await createComment({
    ...commentGeneralOptions(),
    body: `${title}
<details>
<summary>${getSummary(result.stats)}</summary>
${getTable(getExamples(result.results))}
</details>
`
  });
}

exports.getTable = getTable
exports.getExamples = getExamples
exports.getSummary = getSummary
exports.report = report
