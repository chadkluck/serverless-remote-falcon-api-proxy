# Remote Falcon Proxy - Serverless Application

This is a serverless application built with AWS SAM that provides a JWT proxy for Remote Falcon API integration.

## Prerequisites

- AWS CLI configured with appropriate credentials
- SAM CLI installed
- Node.js 18+ installed

## Deployment

### Build the application
```bash
sam build
```

### Deploy to AWS
```bash
sam deploy --guided  # First time deployment
# or
sam deploy  # Subsequent deployments
```

### Local Development
```bash
sam local start-api
```

## Project Structure

```
├── template.yaml          # SAM template
├── samconfig.toml         # SAM configuration
├── src/                   # Lambda function source code
│   ├── index.js          # Main Lambda handler
│   └── package.json      # Node.js dependencies
└── README.md             # This file
```

## Environment Variables

The Lambda function uses the following environment variables:
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `REMOTE_FALCON_ACCESS_TOKEN_PARAM`: SSM parameter name for access token
- `REMOTE_FALCON_SECRET_KEY_PARAM`: SSM parameter name for secret key
- `REMOTE_FALCON_API_BASE_URL`: Base URL for Remote Falcon API

## API Endpoints

- `POST /auth/token` - Generate JWT token
- `GET /proxy/{proxy+}` - Proxy requests to Remote Falcon API
- `OPTIONS /*` - CORS preflight requests