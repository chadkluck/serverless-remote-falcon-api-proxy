# Remote Falcon JWT Proxy Lambda Function

This AWS Lambda function provides secure server-side JWT authentication for the Remote Falcon API, eliminating the need to expose credentials in the client-side JavaScript bundle.

## Architecture

```
Frontend (React) → API Gateway → Lambda Function → Remote Falcon API
                                      ↓
                              AWS Parameter Store
                              (Secure Credentials)
```

## Features

- **Secure Credential Storage**: Uses AWS Systems Manager Parameter Store with encryption
- **JWT Token Generation**: Server-side JWT creation using Remote Falcon secret key
- **Request Proxying**: Forwards authenticated requests to Remote Falcon API
- **Caching**: Intelligent caching of credentials and JWT tokens for performance
- **CORS Support**: Proper CORS handling for web applications
- **Error Handling**: Comprehensive error handling and logging
- **Rate Limiting**: API Gateway integration with usage plans

## Environment Variables

The Lambda function requires these environment variables:

- `REMOTE_FALCON_ACCESS_TOKEN_PARAM`: SSM Parameter name for access token
- `REMOTE_FALCON_SECRET_KEY_PARAM`: SSM Parameter name for secret key  
- `REMOTE_FALCON_API_BASE_URL`: Base URL for Remote Falcon API
- `ALLOWED_ORIGIN`: CORS allowed origin for the API
- `AWS_REGION`: AWS region (automatically set by Lambda runtime)

## API Endpoints

### POST /auth/token
Generates a JWT token for Remote Falcon API authentication.

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

### GET /proxy/showDetails
Proxies request to Remote Falcon API to get show details.

### POST /proxy/addSequenceToQueue
Proxies request to add a sequence to the jukebox queue.

### POST /proxy/voteForSequence
Proxies request to vote for a sequence.

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate permissions
2. Remote Falcon access token and secret key
3. Node.js 18+ for local development

### Using CloudFormation

1. Deploy the CloudFormation stack:
```bash
aws cloudformation create-stack \
  --stack-name remote-falcon-proxy-dev \
  --template-body file://../.kiro/specs/remote-falcon-integration/cloudformation-template.yml \
  --parameters ParameterKey=Environment,ParameterValue=dev \
               ParameterKey=RemoteFalconAccessToken,ParameterValue=your_access_token \
               ParameterKey=RemoteFalconSecretKey,ParameterValue=your_secret_key \
               ParameterKey=AllowedOrigin,ParameterValue=https://your-domain.com \
  --capabilities CAPABILITY_NAMED_IAM
```

2. Package and deploy the Lambda function:
```bash
# Install dependencies
npm install

# Create deployment package
npm run deploy

# Update Lambda function code
aws lambda update-function-code \
  --function-name RemoteFalconProxy-dev \
  --zip-file fileb://remote-falcon-proxy.zip
```

### Manual Deployment

1. Create SSM Parameters:
```bash
# Create access token parameter
aws ssm put-parameter \
  --name "/remotefalcon/dev/access-token" \
  --value "your_access_token" \
  --type "SecureString" \
  --description "Remote Falcon Access Token" \
  --profile chadkluck

# Create secret key parameter
aws ssm put-parameter \
  --name "/remotefalcon/dev/secret-key" \
  --value "your_secret_key" \
  --type "SecureString" \
  --description "Remote Falcon Secret Key" \
  --profile chadkluck
```

2. Create Lambda function and API Gateway manually through AWS Console

## Security Considerations

- **Credentials**: Never commit actual credentials to version control
- **Parameter Store**: Uses SecureString type with KMS encryption
- **IAM Permissions**: Lambda has minimal permissions (SSM read-only)
- **CORS**: Configure allowed origins appropriately for your domain
- **Rate Limiting**: API Gateway usage plans prevent abuse
- **Logging**: CloudWatch logs for monitoring and debugging

## Monitoring

The function logs to CloudWatch Logs with the following log groups:
- `/aws/lambda/RemoteFalconProxy-{environment}`

Key metrics to monitor:
- Function duration
- Error rate
- Throttles
- Parameter Store API calls

## Troubleshooting

### Common Issues

1. **Parameter not found**: Verify SSM parameter names and IAM permissions
2. **CORS errors**: Check ALLOWED_ORIGIN environment variable
3. **JWT errors**: Verify secret key matches Remote Falcon configuration
4. **Timeout errors**: Check Remote Falcon API availability

### Debug Mode

Enable debug logging by setting CloudWatch log level to DEBUG in the Lambda environment variables.

## Cost Optimization

- **Credential Caching**: 5-minute cache reduces SSM API calls
- **JWT Caching**: 55-minute cache reduces token generation overhead
- **Memory**: Function uses 256MB memory for optimal cost/performance
- **Timeout**: 30-second timeout prevents runaway executions

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests (if implemented)
npm test

# Package for deployment
npm run deploy
```

### Environment Variables for Local Development

Create a `.env` file (not committed) with:
```
REMOTE_FALCON_ACCESS_TOKEN_PARAM=/remotefalcon/dev/access-token
REMOTE_FALCON_SECRET_KEY_PARAM=/remotefalcon/dev/secret-key
REMOTE_FALCON_API_BASE_URL=https://remotefalcon.com/remote-falcon-external-api
ALLOWED_ORIGIN=http://localhost:3001
```

## Production Deployment

For production deployment:

1. Use separate parameter paths: `/remotefalcon/prod/access-token`
2. Configure appropriate CORS origins
3. Set up CloudWatch alarms for monitoring
4. Enable AWS X-Ray tracing for debugging
5. Use API Gateway custom domain names
6. Implement API keys for additional security

## Version History

- **v1.0.0**: Initial implementation with JWT proxy functionality
- **v1.1.0**: Added credential and token caching
- **v1.2.0**: Enhanced error handling and logging