'use strict'

const expect = require('chai').expect
const mocha = require('mocha')
const describe = mocha.describe
const it = mocha.it
const beforeEach = mocha.beforeEach
const afterEach = mocha.afterEach

const cli = require('heroku-cli-util')
const nock = require('nock')

const cmd = require('../../commands/wait')

describe('ps:wait', () => {
  let heroku

  beforeEach(() => {
    cli.mockConsole()
    cli.exit.mock()
    heroku = nock('https://api.heroku.com')
  })

  afterEach(() => {
    heroku.done()
    nock.cleanAll()
  })

  it('exits with an error if both --type and --with-run are specified', () => {
    return cmd.run({app: 'sushi', args: {}, flags: {'type': 'web', 'with-run': true}})
              .catch((err) => {
                if (err.code !== 1) throw err
                expect(cli.stdout).to.be.empty
                expect(cli.stderr).to.equal(' ▸    Cannot specify both --type and --with-run\n')
              })
  })

  it('exits with an error if the app has no releases', () => {
    heroku.get('/apps/sushi/releases')
          .reply(200, [])

    return cmd.run({app: 'sushi', args: {}, flags: {}})
              .catch((err) => {
                if (err.code !== 1) throw err
                expect(cli.stdout).to.equal('')
                expect(cli.stderr).to.equal(' ▸    App sushi has no releases\n')
              })
  })

  it('exits right away with no output if app is already on the latest release', () => {
    heroku.get('/apps/sushi/releases')
          .reply(200, [ { id: '00000000-0000-0000-0000-000000000000', version: '23' } ])
    heroku.get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'web' }
          ])

    return cmd.run({app: 'sushi', args: {}, flags: {}})
              .then(() => {
                expect(cli.stdout).to.be.empty
                expect(cli.stderr).to.be.empty
              })
  })

  it('waits for dynos to be up and on current release', () => {
    heroku.get('/apps/sushi/releases')
          .reply(200, [ { id: '00000000-0000-0000-0000-000000000001', version: '23' } ])
    heroku.get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'starting', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'up', type: 'web' }
          ])

    return cmd.run({app: 'sushi', args: {}, flags: {'wait-interval': '0.001'}})
              .then(() => {
                expect(cli.stdout).to.be.empty
                expect(cli.stderr).to.equal('Waiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 1 / 1, done\n')
              })
  })

  it('ignores release dynos', () => {
    heroku.get('/apps/sushi/releases')
          .reply(200, [ { id: '00000000-0000-0000-0000-000000000001', version: '23' } ])
    heroku.get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'up', type: 'release' },
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'starting', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'up', type: 'web' }
          ])

    return cmd.run({app: 'sushi', args: {}, flags: {'wait-interval': '0.001'}})
              .then(() => {
                expect(cli.stdout).to.be.empty
                expect(cli.stderr).to.equal('Waiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 1 / 1, done\n')
              })
  })

  it('ignores run dynos by default', () => {
    heroku.get('/apps/sushi/releases')
          .reply(200, [ { id: '00000000-0000-0000-0000-000000000001', version: '23' } ])
    heroku.get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'run' },
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'run' },
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'starting', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'run' },
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'up', type: 'web' }
          ])

    return cmd.run({app: 'sushi', args: {}, flags: {'wait-interval': '0.001'}})
              .then(() => {
                expect(cli.stdout).to.be.empty
                expect(cli.stderr).to.equal('Waiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 1 / 1, done\n')
              })
  })

  it('includes run dynos with --with-run flag', () => {
    heroku.get('/apps/sushi/releases')
          .reply(200, [ { id: '00000000-0000-0000-0000-000000000001', version: '23' } ])
    heroku.get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'run' },
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'starting', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'up', type: 'run' },
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'up', type: 'web' }
          ])

    return cmd.run({app: 'sushi', args: {}, flags: {'wait-interval': '0.001', 'with-run': true}})
              .then(() => {
                expect(cli.stdout).to.be.empty
                expect(cli.stderr).to.equal('Waiting for every dyno to be running v23... 0 / 2\nWaiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 2 / 2, done\n')
              })
  })

  it('waits for dynos of a specific type with --type flag', () => {
    heroku.get('/apps/sushi/releases')
          .reply(200, [ { id: '00000000-0000-0000-0000-000000000001', version: '23' } ])
    heroku.get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'worker' },
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000000' }, state: 'up', type: 'worker' },
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'starting', type: 'web' }
          ])
          .get('/apps/sushi/dynos')
          .reply(200, [
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'starting', type: 'worker' },
            { release: { id: '00000000-0000-0000-0000-000000000001' }, state: 'up', type: 'web' }
          ])

    return cmd.run({app: 'sushi', args: {}, flags: {'wait-interval': '0.001', 'type': 'web'}})
              .then(() => {
                expect(cli.stdout).to.be.empty
                expect(cli.stderr).to.equal('Waiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 0 / 1\nWaiting for every dyno to be running v23... 1 / 1, done\n')
              })
  })
})
