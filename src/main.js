#!/usr/bin/env node

const { fetchAndExecuteRequests } = require("./RapidRequest");
const { fetchAndExecuteTests } = require("./RapidTest");
const models = require("./models");
const utils = require("./utils");
const RapidRequest = require("./RapidRequest");
const RapidTest = require("./RapidTest");

const consola = require("consola");
const { program } = require("commander");
const pjson = require("../package.json");

if (require.main === module) {
  // local execution
  execute({ Records: [{ body: null }] }, {});
}

// eslint-disable-next-line no-unused-vars
async function execute(event, _context) {
  let baseURlFromEvent;
  const body = event.Records?.[0]?.body;
  if (body) {
    baseURlFromEvent = JSON.parse(body)?.baseUrl;
  }
  const ignoreSSL = "false"; // Fail any "https" tests with missing cert.

  program.version(pjson.version);
  program
    .description("Start worker to execute RapidAPI tests and requests")
    .requiredOption(
      "-u, --url <baseUrl>",
      "The base URL to fetch executions from (env variable: BASE_URL)",
      // default workers get baseUrl from SQS event body, otherwise from config
      baseURlFromEvent || process.env.BASE_URL || "https://rapidapi.com/testing"
    )
    .requiredOption(
      "-s, --secret <secret>",
      "Location secret for fetching executions ",
      process.env.LOCATION_SECRET || process.env.KEY
    )
    .requiredOption(
      "-k, --key <key>",
      "Location key for fetching executions. Must match secret.",
      process.env.LOCATION_KEY || process.env.LOCATION
    )
    .requiredOption(
      "-c, --context <context>",
      "API context (user ID or organization ID) for fetching executions",
      process.env.LOCATION_CONTEXT
    )
    .option(
      "-f, --frequency <frequency>",
      "ms interval between fetching new tests executions. If the frequency is undefined, the worker will only execute once. (default: undefined)",
      process.env.FREQUENCY || process.env.INTERVAL
    )
    .option(
      "-m, --max <max>",
      "The max amount of milliseconds to run intervals. If this is undefined, the worker will continue to run until the process is terminated. (default: undefined)",
      process.env.POLLING_TIME_MAX
    )
    .option(
      "-b, --batch <batch>",
      "The number of test executions to process each interval",
      process.env.BATCH_SIZE || 100
    )
    .option(
      "-l, --logging [on, off, cli]",
      "Logging level. 'cli' prints additional information at startup useful for debugging",
      process.env.WORKER_LOGGING || "off"
    )
    .option(
      "--ignore-ssl [true, false]",
      "Ignore a missing or self-signed SSL certificate from an API endpoint",
      process.env.IGNORE_MISSING_SSL_CERT || ignoreSSL
    );

  program.parse();
  const cmd = program.opts();

  const logging = cmd.logging === "on" || cmd.logging === "cli";

  if (cmd.logging === "cli") {
    consola.info(`Starting a the worker version: ${pjson.version} from the CLI with the following settings:\n`);
    consola.info(`RapidAPI Testing base URL <url>: ${cmd.url}`);
    consola.info(`RapidAPI Testing location secret <secret>: ${cmd.secret.substr(0, 3)}********`);
    consola.info(`RapidAPI Testing location key <key>: ${cmd.key}`);
    consola.info(`RapidAPI Testing context (user or organization ID) <context>: ${cmd.context}`);
    consola.info(`Frequency the worker will poll for new test/requests to be executed <frequency>: ${cmd.frequency}`);
    consola.info(`Maximum time in milliseconds this worker will keep polling for tests/requests <max>: ${cmd.max}`);
    consola.info(`Number of requests/tests to dequeue on each interval <max>: ${cmd.batch}`);
    consola.info(`Ignore missing SSL certificates for https requests: ${cmd.ignoreSsl}\n`);
  }

  // Store the settings in a global so they cab be read anywhere
  global.settings = {
    baseUrl: cmd.url,
    locationSecret: cmd.secret,
    locationKey: cmd.key,
    locationContext: cmd.context === "Default" ? undefined : cmd.context,
    batchSize: cmd.batch,
    logging,
    ignoreSSL: cmd.ignoreSsl,
  };

  const START_TIMESTAMP = Date.now();

  let cycle = 1;
  if (!cmd.frequency) {
    if (logging) consola.log(`Staring cycle ${cycle}`);
    try {
      await executeOnce({ ...global.settings });
    } catch (err) {
      consola.error(err);
    }
  } else {
    let unresolvedCycles = 0;
    let maxTimeReached = false;
    const testLoop = new Promise((resolve) => {
      const interval = setInterval(async function () {
        if (parseInt(cmd.max)) {
          let currentTimestamp = Date.now();
          if (currentTimestamp > parseInt(START_TIMESTAMP) + parseInt(cmd.max)) {
            if (logging) consola.log(`Max polling time reached`);
            clearInterval(interval);
            maxTimeReached = true;
            if (unresolvedCycles <= 0) {
              resolve();
            }
            return;
          }
        }
        if (logging) {
          // eslint-disable-next-line
          console.log(`Staring cycle ${cycle++}`);
        }
        try {
          unresolvedCycles += 1;
          await executeOnce({ ...global.settings });
        } catch (err) {
          consola.error(err);
        } finally {
          unresolvedCycles -= 1;
          if (maxTimeReached && unresolvedCycles <= 0) {
            resolve();
          }
        }
      }, cmd.frequency);
    });
    await testLoop;
    if (logging) {
      consola.log(`End execute()`);
    }
  }
}

async function executeOnce(overwriteDetails = {}) {
  // eslint-disable-next-line max-len
  return Promise.all([fetchAndExecuteTests(overwriteDetails), fetchAndExecuteRequests(overwriteDetails)]).catch((e) => {
    if (global.settings.logging) {
      if (e.response) {
        consola.error(`fetchAndExecute error: ${e.response.status}, ${e.response.statusText}, ${e.response.data}`);
      } else {
        consola.error(`fetchAndExecute error: ${e}`);
      }
    }
  });
}

module.exports = {
  execute,
  executeOnce,
  models,
  utils,
  RapidRequest,
  RapidTest,
};
