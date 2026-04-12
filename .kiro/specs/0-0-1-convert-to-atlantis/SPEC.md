# Convert to Atlantis

I have scaffold the project to use the Atlantis Application starter #2. As with all atlantis projects, the deployment and source is in application-infrastructure/
All supporting documentation for Atlantis Starter #2 is in the root of the project directory.

I have a complete application in old-backend/ which is a complete working example of what needs to be converted to an Atlantis application. It is a web service that was built outside of the atlantis platform, it now needs to be brought into the platform framework.

- All tests for old-backend CURRENTLY WORK
- the code for old-backend IS CORRECT. 
- Files in old-backend/ SHOULD NOT BE MODIFIED so that we can ensure 1:1 parity.

The converted application needs to have the same API endpoints, behavior, needs to call the same endpoints, exhibit the same behavior as the old-backend.

Testing for exact implementation is essential.

The converted application needs to:

- Adhere to Atlantis patterns
- Use Cache Data tools, cache, and endpoint properly
- Ensure the Model-View-Control pattern of the current application-infrastructure is maintained
- Utilize Cache-Data tools.ClientRequest, tools.Response, tools.DebugAndLog, tools.CachedParameterSecrets, tools.CachedSsmParameter, etc

old-backend has a class named ClientInfo, Cache-Data tools.ClientRequest should be used instead. It appears there are equivalent classes.

The new application should not duplicate existing cache-data classes or methods. Be sure to refer to cache-data documentation and npm package code to check for method signatures.

I have already created a copy of RemoteFalconLogBuilder.js class in src/utils

I have also already created the command to check/create the necessary RemoteFalcon parameters:
${PARAM_STORE_HIERARCHY}RemoteFalcon/access-token
${PARAM_STORE_HIERARCHY}RemoteFalcon/secret-key
Be sure these are used instead of the current parameter paths mentioned in the old-backend/template.yml

The template-openapi-spec.yml will also need to be updated.

In the end, ARCHITECTURE.md, DEPLOYMENT.md and docs/ need to be updated as well.

This is an important project, a careful, well-planned conversion needs to take place.

Please make sure to review all the old code, all necessary documentation for Atlantis, and utilize the existing tests to make sure we are producing the exact behaviors after the conversion.

Ask any clarifying questions in SPEC-QUESTIONS.md and ensure we have proper answers before moving on to the spec-driven process.