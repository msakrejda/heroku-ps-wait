'use strict'

const cli = require('heroku-cli-util')
const co = require('co')

function * psWait (context, heroku) {
  if (context.flags['with-run'] && context.flags['type']) {
    cli.exit(1, 'Cannot specify both --type and --with-run')
  }

  let [ appInfo, releases ] = [
    yield heroku.get(`/apps/${context.app}`),
    yield heroku.request({
      path: `/apps/${context.app}/releases`,
      partial: true,
      headers: {
        'Range': 'version ..; max=1, order=desc'
      }
    })
  ]

  if (!appInfo.space) {
    cli.exit(1, `App ${context.app} is not in a Private Space`)
  }

  if (releases.length === 0) {
    cli.exit(1, `App ${context.app} has no releases`)
  }

  const latestRelease = releases[0]

  let released = true
  let wait = require('co-wait')
  let interval = parseFloat(context.flags['wait-interval'])
  if (!interval || interval < 0) {
    interval = 10
  }

  while (true) {
    let dynos = yield heroku.get(`/apps/${context.app}/dynos`)
    dynos = dynos.filter((dyno) => dyno.type !== 'release')
                 .filter((dyno) => context.flags['with-run'] || dyno.type !== 'run')
                 .filter((dyno) => !context.flags.type || dyno.type === context.flags.type)

    let onLatest = dynos.filter((dyno) => {
      return dyno.state === 'up' && dyno.release.id === latestRelease.id
    })
    if (onLatest.length === dynos.length) {
      if (!released) {
        cli.action.done(`${onLatest.length} / ${dynos.length}, done`)
      }
      return
    }

    if (released) {
      released = false
      cli.action.start(`Waiting for every dyno to be running v${latestRelease.version}`)
    }

    cli.action.status(`${onLatest.length} / ${dynos.length}`)

    yield wait(interval * 1000)
  }
}

module.exports = {
  topic: 'ps',
  command: 'wait',
  description: 'wait for a private spaces release to cycle in',
  help: `
Applications in Heroku Private Spaces cycle dynos one at a time when 
a new release is made. This command allows you to wait until
all dynos are on the latest release version.
  `,
  needsAuth: true,
  needsApp: true,
  flags: [
    { name: 'wait-interval', char: 'w', description: 'how frequently to poll in seconds (to avoid rate limiting)', hasValue: true },
    { name: 'with-run', char: 'R', description: 'whether to wait for one-off run dynos', hasValue: false },
    { name: 'type', char: 't', description: 'wait for one specific dyno type', hasValue: true }
  ],
  run: cli.command(co.wrap(psWait))
}
