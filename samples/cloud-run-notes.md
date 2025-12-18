# Cloud Run Operational Notes (Sample Document)

Cloud Run is a managed serverless container platform that scales HTTP services automatically based on incoming request traffic.

## Concurrency and Cold Starts
By default, a Cloud Run revision can handle up to 80 concurrent requests per container instance. When traffic drops to zero and `min-instances` is set to 0, the next request triggers a cold start while a new container boots and initializes its runtime. Setting `min-instances` to 1 eliminates cold starts for the first instance, but incurs continuous idle instance billing.

## Direct VPC Egress
To reach a private Cloud SQL instance over an internal VPC IP address without a separate Serverless VPC Access connector, Cloud Run services can configure Direct VPC Egress with `PRIVATE_RANGES_ONLY` routing. This keeps database traffic on the private VPC network while allowing outbound internet calls to Google APIs or public endpoints.
