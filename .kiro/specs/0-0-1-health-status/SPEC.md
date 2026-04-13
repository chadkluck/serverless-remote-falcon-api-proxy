# Health Status

There is currently a telemetry event for health received as a POST request.

We want to update the response to a health event to also include whether the application was successful in contacting the Remote Falcon service.

This should be a sub-object within the health status object returned that lists a boolean if it was successful, and a few minor details returned from remote falcon. We don't need to return the songs, music, or playlist.

We do not need to worry about backwards compatibility.

Ask any questions, and provide any recommendations, in SPEC-QUESTIONS.md and have the user answer them there before moving on to the Spec-Driven workflow.