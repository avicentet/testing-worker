const { recursiveReplace } = require("./utils");
const axios = require("axios");
const Context = require("./models/Context");
const { Http } = require("./models/actions/Http");

const { pick } = require("./utils");

const fetchRequests = async ({ baseUrl, locationSecret, locationKey, locationContext, batchSize, logging }) => {
  let requests = [];
  if (logging) consola.info(`Getting requests from ${baseUrl}/api/location/request?amount=${batchSize}`);
  const headers = {
    "x-location-secret": locationSecret,
  };
  headers["x-location-key"] = locationKey;

  if (locationContext) {
    headers["x-location-context"] = locationContext;
  }
  let requestsResponse = (
    await axios.get(`${baseUrl}/api/location/request?amount=${batchSize}`, {
      headers,
      timeout: 15000,
    })
  ).data;
  requests = requestsResponse["requests"];
  return requests;
};

const sendRequestResult = async (
  request,
  response,
  executionTime,
  { baseUrl, locationSecret, locationKey, locationContext, batchSize }
) => {
  const headers = {
    "x-location-secret": locationSecret,
  };
  headers["x-location-key"] = locationKey;
  if (locationContext) {
    headers["x-location-context"] = locationContext;
  }
  try {
    await axios.post(
      `${baseUrl}/api/location/request/${request.id}`,
      {
        response,
        executionTime,
      },
      {
        headers,
        timeout: 15000,
      }
    );
  } catch (e) {
    console.log(e);
  }
};

const processRequest = async (req) => {
  const mockContext = new Context({});
  const action = new Http(req);
  const result = await action.eval(mockContext);
  const executionTime = result.actionReports && result.actionReports.length > 0 && result.actionReports[0].time;
  return {
    response: pick(result.response, ["data", "headers", "status"]),
    executionTime,
  };
};

const executeRequest = async (request, locationDetails) => {
  context = new Context({
    ...request.testVariables,
    ...request.envVariables,
  });
  const transformedRequest = recursiveReplace(request.request, context.data);

  let { response, executionTime } = await processRequest(transformedRequest);
  await sendRequestResult(request, response, executionTime, locationDetails);
};

const fetchAndExecuteRequests = async (locationDetails) => {
  const requests = await fetchRequests(locationDetails);
  if (locationDetails.logging) console.log(requests);
  await Promise.all(
    requests.map((request) => {
      try {
        return executeRequest(request, locationDetails);
      } catch (e) {
        console.error(e);
      }
    })
  );

  if (locationDetails.logging) consola.success(`Executed ${requests.length} requests`);
};

module.exports = {
  fetchAndExecuteRequests,
};