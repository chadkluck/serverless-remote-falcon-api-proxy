# API Gateway with Lambda utilizing 63klabs/cache-data Written in Node.js

An application starter template to demonstrate Atlantis Template for AWS CodePipeline to provision a web service that utilizes API Gateway and an advanced Lambda function written in Node.js that implements various features of the [@63klabs/cache-data](https://www.npmjs.com/package/@63klabs/cache-data) NPM package.

| | Build/Deploy | Application Stack |
|---|---|---|
| **Languages** | Python, Shell | Node.js |
| **Frameworks** | Atlantis, Jest | Atlantis, @63klabs/cache-data |
| **Features** | SSM Parameters | API Gateway, Lambda, CloudWatch Logs, CloudWatch Alarms, CloudWatch Dashboard, X-Ray Tracing, Lambda Insights, Open API Spec, @63klabs/cache-data |

> **Ready-to-Deploy-and-Run** with the [63Klabs Atlantis Templates and Scripts Platform for Serverless Deployments on AWS](https://github.com/63Klabs/atlantis)

## Features

- API Gateway implementation (with additional logging if enabled)
- Lambda Function with gradual deployment and rollback in production environments
- AWS X-Ray Tracing between API Gateway, Lambda, S3, DynamoDb, and remote endpoints
- Lambda Insights, CloudWatch logs, and a CloudWatch Dashboard for monitoring performance
- Cache-Data implementation:
  - Configuration: Connections, SSM Parameter Store Secrets, Cache
  - Logging: DebugAndLog, Timer
  - Caching of data from remote endpoints using S3 and DynamoDb (provision separately or with application)
  - Request handling: Router, Validation, response formatting and logging

## Tutorial

> Note: To keep this example VERY basic and simple, concepts such as routing, caching, and advanced monitoring are not used. For near production-ready examples, review the the other Atlantis starter applications.

1. Read the [Atlantis Tutorials introductory page](https://github.com/63Klabs/atlantis-tutorials)
2. Then perform the steps outlined in [Tutorial #2: API Gateway and Lambda using Cache-Data (Node)](https://github.com/63Klabs/atlantis-tutorials/blob/main/tutorials/02-advanced-api-gateway-lambda-cache-data-node/README.md).
## Architecture

See [Architecture](./ARCHITECTURE.md)

## Deployment Guide

See [Deployment Guide](./DEPLOYMENT.md)

## Advanced Documentation

See [Docs Directory](./docs/README.md)

## AI Context

See [AGENTS.md](./AGENTS.md) for important context and guidelines for AI-generated code in this repository.

The agents file is also helpful (and perhaps essential) for HUMANS developing within the application's structured platform as well.

## Changelog

See [Change Log](./CHANGELOG.md)

## Contributors

- [63Klabs](https://github.com/63klabs)
- [Chad Kluck](https://github.com/chadkluck)
