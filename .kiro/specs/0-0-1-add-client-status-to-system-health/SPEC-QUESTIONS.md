# SPEC Questions & Recommendations

Before starting the spec-driven workflow, I have a few questions and recommendations. Please answer inline below each question.

---

## Questions

### Q1: IP Address Privacy

The `clientInfo.ipAddress` is currently available in the controller via `props.clientInfo`. Echoing the client's IP back in the response could have privacy implications (e.g., GDPR). Should the IP be:

- (a) Returned as-is from `clientInfo.ipAddress`
- (b) Masked/truncated (e.g., `192.168.1.xxx`)
- (c) Omitted from the response entirely and only kept in logs

**Answer:**
A return as is. It is the user requesting the info anyways

### Q2: Non-systemHealth Events

The `clientStatus` property is only relevant for `systemHealth` events. Should the response for non-systemHealth events remain unchanged (no `clientStatus` property at all)?

**Answer:**
only update systemHealth events, leave all other events the same

### Q3: eventData Pass-Through vs Validated Copy

The `eventData` in the SPEC example includes `totalRequests`, `failedRequests`, `errorRate`, and `rateLimitStatus`. The service already validates these fields. Should `clientStatus.eventData`:

- (a) Be a direct pass-through of the validated `eventData` from the request body (including any extra fields the client sends)
- (b) Be a curated copy containing only the known/validated fields (`totalRequests`, `failedRequests`, `errorRate`, `rateLimitStatus`)

**Answer:**
(a) be a direct pass through of the validated eventData

### Q4: Missing or Partial eventData Fields

If `rateLimitStatus` is not provided in the request (it's optional per current validation), should `clientStatus.eventData.rateLimitStatus`:

- (a) Be omitted from the response
- (b) Be included with default values (e.g., `{ isRateLimited: false, requestsInWindow: 0 }`)

**Answer:**
(a) omit
---

## Recommendations

### R1: Placement in the View Layer

The `clientStatus` formatting should live in `telemetry.view.js` alongside the existing `remoteFalcon` formatting. The controller would pass `clientStatus` data into the view, keeping the separation of concerns clean.

### R2: Keep the Controller as Orchestrator

The controller already assembles `viewData` with `processingTime` and `remoteFalcon`. Adding `clientStatus` follows the same pattern — the controller builds the data object and the view formats it. No new service layer logic is needed for this since it's an echo of already-validated request data.

### R3: Property Ordering

The SPEC shows `clientStatus` after `remoteFalcon` in the response. I'll maintain that ordering in the view to match the expected contract.

---

Please fill in your answers above, and I'll proceed with the spec-driven workflow once you're ready.
