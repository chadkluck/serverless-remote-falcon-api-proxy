# Serverless Remote Falcon API Proxy and Site Telemetry

A web service that serves as a reverse-proxy for custom, self-hosted light show websites to access the Remote Falcon API allowing visitors to see song lists, current status, and make requests. Also includes metric and telemetry data of user interactions with the website. Utilizes API Gateway and an advanced Lambda function written in Node.js that implements various features of the [@63klabs/cache-data](https://www.npmjs.com/package/@63klabs/cache-data) NPM package. All built and deployed upon the [63Klabs Atlantis Template and Scripts Platform](https://github.com/63klabs/atlantis).

| | Build/Deploy | Application Stack |
|---|---|---|
| **Languages** | Python, Shell | Node.js |
| **Frameworks** | Atlantis, Jest | Atlantis, @63klabs/cache-data, jose |
| **Features** | SSM Parameters | API Gateway, Lambda, CloudWatch Logs, CloudWatch Alarms, CloudWatch Dashboard, X-Ray Tracing, Lambda Insights, Open API Spec, @63klabs/cache-data, Remote Falcon API |

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
