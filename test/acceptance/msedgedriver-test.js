'use strict';

const { describe, it } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const path = require('path');
const { oldVersion } = require('../helpers/edge');

const installerPath = require.resolve('../../bin/install-msedgedriver');
const binPath = require.resolve('../../bin/msedgedriver.js');

const startedRegex = /^msedgedriver was started successfully on port \d+\.$/m;

describe(path.basename(binPath), function() {
  this.timeout(30e3);

  before(async function() {
    const { execaNode } = await import('execa');

    await execaNode(installerPath);
  });

  it('works', async function() {
    const { execaNode } = await import('execa');

    let ps = execaNode(binPath);

    let isSuccess = false;

    ps.stdout.on('data', data => {
      let stdout = data.toString();

      if (startedRegex.test(stdout)) {
        ps.kill();

        isSuccess = true;
      }
    });

    await expect(ps).to.eventually.be.rejectedWith('Command was killed with SIGTERM');

    expect(isSuccess).to.equal(true);
  });

  it('can find bin even if different version', async function() {
    const { execaNode } = await import('execa');

    let ps = execaNode(binPath, [], {
      env: {
        EDGEDRIVER_VERSION: oldVersion,
      },
    });

    let isSuccess = false;

    ps.stdout.on('data', data => {
      let stdout = data.toString();

      if (startedRegex.test(stdout)) {
        ps.kill();

        isSuccess = true;
      }
    });

    await expect(ps).to.eventually.be.rejectedWith('Command was killed with SIGTERM');

    expect(isSuccess).to.equal(true);
  });
});
