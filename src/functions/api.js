const { app: azureApp } = require('@azure/functions');
const serverless = require('serverless-http');
const expressApp = require('../expressApp');

const handler = serverless(expressApp);

azureApp.http('api', {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  authLevel: 'anonymous',
  route: '{*segment}',
  handler: async (request, context) => {
    return handler(request, context);
  },
});
