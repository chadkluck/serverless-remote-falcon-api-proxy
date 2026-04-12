# Documentation for Developers

## MVC Structure

The application follows the Atlantis MVC pattern:

```
src/
├── index.js              # Lambda handler (cold-start init, delegates to Router)
├── config/               # Configuration, connections, settings, SSM parameters
├── routes/index.js       # Router — parses event, dispatches to controllers
├── controllers/          # Coordinate services and format responses via views
├── services/             # Business logic (JWT, proxy forwarding, telemetry)
├── models/               # Data access objects (Remote Falcon API communication)
├── views/                # Response formatting
├── utils/                # Shared utilities (CORS, logging, hashing)
└── tests/                # Unit and property-based tests
```

### Request Lifecycle

1. `index.js` handler → `Config.promise()` / `Config.prime()` → `Routes.process(event, context)`
2. Router creates `ClientRequest` + `Response`, applies CORS headers, dispatches to controller
3. Controller calls service(s), passes result to view, returns `{statusCode, body}`
4. Router applies result to `Response`, logs `REQUEST_METRICS`, returns `Response`

## Adding a New Endpoint

1. Add the route in `src/routes/index.js` (method + path check)
2. Create or update a controller in `src/controllers/`
3. Create or update a service in `src/services/` for business logic
4. Create or update a view in `src/views/` for response formatting
5. Update barrel exports in each layer's `index.js`
6. Add the API Gateway event in `template.yml` under `AppFunction.Properties.Events`
7. Add the path in `template-openapi-spec.yml`
8. Write tests in `src/tests/`

## Testing

### Running Tests

```bash
# Install dependencies
npm install --prefix application-infrastructure/src

# Run all tests
npm test --prefix application-infrastructure/src

# Run a specific test file
npx jest --config application-infrastructure/src/jest.config.js application-infrastructure/src/tests/cors.test.js
```

### Test Organization

| File | Coverage |
|------|----------|
| `cors.test.js` | CORS origin matching, security headers |
| `cors.property.test.js` | Property tests for CORS across random inputs |
| `jwt.service.test.js` | JWT generation, caching, SSM retrieval |
| `jwt.property.test.js` | Property tests for JWT structure |
| `proxy.controller.test.js` | Proxy forwarding, path stripping, error handling |
| `proxy.property.test.js` | Property tests for proxy round-trip |
| `telemetry.service.test.js` | Telemetry validation, PII detection, size limits |
| `telemetry.property.test.js` | Property tests for telemetry validation |
| `logging.property.test.js` | Property tests for log classification and PII sanitization |
| `router.test.js` | Route dispatch, OPTIONS preflight, 404 handling |
| `parity.test.js` | Behavioral parity with old-backend mock events |
| `index.test.js` | Handler integration tests |

### Property-Based Tests

Property tests use `fast-check` to verify universal properties across many generated inputs. Each property test references a correctness property from the design document.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@63klabs/cache-data` | Atlantis framework (ClientRequest, Response, caching, SSM, X-Ray) |
| `jose` | JWT generation (HS256 signing) |
| `fast-check` | Property-based testing (devDependency) |

## Related Documentation

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System architecture and design decisions
- [DEPLOYMENT.md](../../DEPLOYMENT.md) — Deployment guide and SSM setup
- [Admin/Ops](../admin-ops/README.md) — SSM parameter management and monitoring
- [End-User](../end-user/README.md) — API endpoints and request/response formats
