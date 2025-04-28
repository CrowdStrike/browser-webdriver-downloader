'use strict';

const { describe, it } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const fs = require('fs').promises;
const { getDriverPath } = require('../../src');
const path = require('path');
const { oldVersion } = require('../helpers/edge');

const installerPath = require.resolve('../../bin/install-msedgedriver');
const driverPath = getDriverPath();

describe(path.basename(installerPath), function() {
  this.timeout(30e3);

  beforeEach(async function() {
    await fs.rm(driverPath, { force: true });
  });

  it('works', async function() {
    const { execaNode } = await import('execa');

    await execaNode(installerPath);

    expect(driverPath).to.be.a.file();
  });

  it('can pin the version', async function() {
    const { execaNode } = await import('execa');

    let ps = await execaNode(installerPath, [], {
      env: {
        EDGEDRIVER_VERSION: oldVersion,
      },
    });

    expect(driverPath).to.be.a.file();

    expect(ps.stdout).to.include(oldVersion);
  });

  it('redownloads if different version', async function() {
    let string = `Found ${driverPath} at different version ${oldVersion}, redownloading`;

    const { execaNode } = await import('execa');

    let ps = await execaNode(installerPath, [], {
      env: {
        EDGEDRIVER_VERSION: oldVersion,
      },
    });

    expect(ps.stdout).to.not.include(string);

    ps = await execaNode(installerPath);

    expect(ps.stdout).to.include(string);
  });

  it('doesn\'t redownload same version', async function() {
    let string = `Found ${driverPath} at version ${oldVersion}, not downloading`;

    const { execaNode } = await import('execa');

    let ps = await execaNode(installerPath, [], {
      env: {
        EDGEDRIVER_VERSION: oldVersion,
      },
    });

    expect(ps.stdout).to.not.include(string);

    ps = await execaNode(installerPath, [], {
      env: {
        EDGEDRIVER_VERSION: oldVersion,
      },
    });

    expect(ps.stdout).to.include(string);
  });

  it('can detect the version', async function() {
    const { execaNode } = await import('execa');

    let ps = await execaNode(installerPath, [], {
      env: {
        DETECT_EDGEDRIVER_VERSION: 'true',
      },
    });

    expect(driverPath).to.be.a.file();
    console.log(ps.stdout);
    expect(ps.stdout).to.include('DETECT_EDGEDRIVER_VERSION=true, detected version ');
  });

  it('can skip download', async function() {
    const { execaNode } = await import('execa');

    let ps = await execaNode(installerPath, [], {
      env: {
        SKIP_EDGEDRIVER_DOWNLOAD: 'true',
      },
    });

    expect(driverPath).to.not.be.a.path();

    expect(ps.stdout).to.include('SKIP_EDGEDRIVER_DOWNLOAD=true, skipping download');
  });
});
