const ProxySvc = require("./proxy.service");
const JwtSvc = require("./jwt.service");
const TelemetrySvc = require("./telemetry.service");
const HealthCheckSvc = require("./health-check.service");

module.exports = {
	ProxySvc,
	JwtSvc,
	TelemetrySvc,
	HealthCheckSvc
};
