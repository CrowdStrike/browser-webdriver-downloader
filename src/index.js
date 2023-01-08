'use strict';

const { promisify } = require('util');
const fs = { ...require('fs'), ...require('fs').promises, ...require('../src/fs') };
const path = require('path');
const extractZip = require('extract-zip');
const pipeline = promisify(require('stream').pipeline);
const os = require('os');
const { createTmpDir } = require('../src/tmp');
const yn = require('yn');

const platform = os.platform();
const arch = os.arch();

const downloadHost = 'https://msedgedriver.azureedge.net';

const driversRoot = path.join(__dirname, '../bin');

function getDownloadName() {
  let firstPart;
  let secondPart;

  if (platform === 'linux' && arch === 'x64') {
    firstPart = 'linux';
    secondPart = '64';
  } else if (platform === 'darwin' && arch === 'x64') {
    firstPart = 'mac';
    secondPart = '64';
  } else if (platform === 'darwin' && arch === 'arm64') {
    firstPart = 'mac';
    secondPart = '64';
  } else if (platform === 'win32' && arch === 'x64') {
    firstPart = 'win';
    secondPart = '64';
  } else if (platform === 'win32' && arch === 'x32') {
    firstPart = 'win';
    secondPart = '32';
  } else if (platform === 'win32' && arch === 'arm64') {
    firstPart = 'arm';
    secondPart = '64';
  } else {
    throw new Error(`${platform} ${arch} not supported`);
  }

  return `edgedriver_${firstPart}${secondPart}.zip`;
}

async function getDriverVersion() {
  let version;

  if (process.env.EDGEDRIVER_VERSION) {
    version = process.env.EDGEDRIVER_VERSION;
  } else if (yn(process.env.DETECT_EDGEDRIVER_VERSION)) {
    version = await getDetectedDriverVersion();
  }

  if (!version) {
    version = await getLatestDriverVersion();
  }

  return version;
}

async function getDetectedDriverVersion() {
  let version;

  if (platform === 'win32') {
    const findEdgeVersion = require('find-edge-version');

    let result;

    try {
      result = await findEdgeVersion();
    } catch (err) {
      if (err.message !== 'MS Edge browser is not found') {
        throw err;
      }
    }

    if (result) {
      version = result.version;
    }
  } else {
    let browserCmd = (() => {
      switch (platform) {
        case 'linux': return 'microsoft-edge';
        case 'darwin': return '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
        default: throw new Error(`Platform "${platform}" not supported`);
      }
    })();

    let ps;

    const { execa } = await import('execa');

    try {
      ps = await execa(browserCmd, ['--version']);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    if (ps) {
      // "Microsoft Edge 105.0.1343.53 "
      version = ps.stdout.match(/(?:\d|\.)+/)[0];
    }
  }

  if (version) {
    console.log(`DETECT_EDGEDRIVER_VERSION=${process.env.DETECT_EDGEDRIVER_VERSION}, detected version ${version}`);
  } else {
    console.log(`DETECT_EDGEDRIVER_VERSION=${process.env.DETECT_EDGEDRIVER_VERSION}, but Microsoft Edge install not found`);
  }

  return version;
}

async function getLatestDriverVersion() {
  const { got } = await import('got');

  let { body } = await got.get(`${downloadHost}/LATEST_STABLE`);

  // For example: '��102.0.1245.33\r\n'
  let version = body.replace(/[^\d.]/g, '');

  return version;
}

function getDriverName() {
  if (platform === 'win32') {
    return 'msedgedriver.exe';
  } else {
    return 'msedgedriver';
  }
}

function getDriverPath(driverName = getDriverName()) {
  return path.resolve(driversRoot, driverName);
}

async function install() {
  let version = await getDriverVersion();

  let driverName = getDriverName();

  let driverPath = getDriverPath(driverName);

  let shouldDownload = true;

  if (await fs.exists(driverPath)) {
    const { execa } = await import('execa');

    let ps = await execa(driverPath, ['--version']);

    // "Microsoft Edge WebDriver 105.0.1343.53 (3a47f00402d579c8ba1fad7e143f9d73831b6765)"
    let existingVersion = ps.stdout.match(/(?:\d|\.)+/)[0];

    if (existingVersion === version) {
      console.log(`Found ${driverPath} at version ${existingVersion}, not downloading`);

      shouldDownload = false;
    } else {
      console.log(`Found ${driverPath} at different version ${existingVersion}, redownloading`);

      await fs.unlink(driverPath);
    }
  }

  if (shouldDownload) {
    await downloadAndExtract({ version, driverName, driverPath });
  }

  console.log(`Edge WebDriver available at ${driverPath}`);

  // await hackLocalBinSymlink();
}

async function downloadAndExtract({ version, driverName, driverPath }) {
  let tmpPath = await createTmpDir();

  let downloadPath = await download({ tmpPath, version });

  await extract({ tmpPath, downloadPath, driverName, driverPath });

  await fs.rm(tmpPath, { recursive: true, force: true });
}

async function download({ tmpPath, version }) {
  let downloadName = getDownloadName();

  let downloadPath = path.join(tmpPath, downloadName);

  let downloadUrl = `${downloadHost}/${version}/${downloadName}`;

  console.log(`Downloading ${downloadUrl}...`);

  const { got } = await import('got');

  await pipeline(
    got.stream(downloadUrl),
    fs.createWriteStream(downloadPath),
  );

  return downloadPath;
}

async function extract({ tmpPath, downloadPath, driverName, driverPath }) {
  console.log(`Extracting ${downloadPath}...`);

  await extractZip(downloadPath, { dir: tmpPath });

  let tmpDriverPath = path.join(tmpPath, driverName);

  await fs.mkdir(path.dirname(driverPath), { recursive: true });

  await fs.rename(tmpDriverPath, driverPath);
}

// eslint-disable-next-line no-unused-vars
async function hackLocalBinSymlink() {
  let packagePath = require.resolve('../package');
  let { bin } = require(packagePath);
  let packageRoot = path.dirname(packagePath);

  for (let [name, _path] of Object.entries(bin)) {
    let dest = path.join(packageRoot, 'node_modules/.bin', name);
    let source = path.relative(path.dirname(dest), path.join(packageRoot, _path));

    try {
      await fs.unlink(dest);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    await fs.symlink(source, dest);

    console.log(`${dest} -> ${source}`);
  }
}

module.exports = {
  getDriverPath,
  install,
};
