# Self-hosting SuspectFraud

Status: **hosted single-owner private pilot verified on 6 November 2026** at [osint.alkamy.ltd](https://osint.alkamy.ltd/tools/suspect-fraud/). [Hosted acceptance](HOSTED-PILOT.md) records public TLS/auth, real OCR, backup/restore and managed restart checks. Private infrastructure identifiers, credentials and incident evidence are excluded from this package.

## Runtime boundary

Deploy two containers: app port 4321 and OCR port 8080. Only the app receives public ingress through an HTTPS reverse proxy. The app needs controlled outbound access for domain research. OCR must have no outbound Internet access, public port or proxy-network connection. Neural training remains an optional offline process, excluded from production.

Retain owner-token authentication. Hosting does not create a public evidence submission service or multi-user access model. Set `PUBLIC_ORIGIN` to the exact external origin, without a path or internal port. The app checks Host and Origin. Allow sufficient API time for the OCR worker's 30-second deadline.

## Plain Docker Compose template

This template is for ordinary Docker Compose. Do not import it unchanged into Coolify: its parser can add external networks to OCR. Use the managed-host differences below and verify actual runtime isolation.

Build reviewed, versioned Linux images from the app and OCR Dockerfiles first. Replace uppercase image, hostname and absolute token-file placeholders with your approved values. Do not put a credential value in this YAML. A raw Compose service receives no local source tree from the requesting machine.

```yaml
services:
  app:
    image: YOUR_REGISTRY/suspect-fraud-app:REVIEWED_RELEASE
    environment:
      PUBLIC_ORIGIN: https://YOUR_OSINT_HOST
      OSINT_OCR_URL: http://ocr:8080/ocr
    expose: ['4321']
    secrets: [osint_token]
    volumes: [cases:/data]
    networks: [egress, evidence]
    depends_on:
      ocr:
        condition: service_healthy
    read_only: true
    tmpfs: ['/tmp:rw,noexec,nosuid,size=64m']
    cap_drop: [ALL]
    security_opt: ['no-new-privileges:true']
    pids_limit: 128
    mem_limit: 512m
    cpus: 1.0
    restart: unless-stopped
    logging:
      driver: json-file
      options: {max-size: 5m, max-file: '2'}
  ocr:
    image: YOUR_REGISTRY/suspect-fraud-ocr:REVIEWED_RELEASE
    networks: [evidence]
    read_only: true
    tmpfs: ['/tmp:rw,noexec,nosuid,size=128m']
    cap_drop: [ALL]
    security_opt: ['no-new-privileges:true']
    pids_limit: 128
    mem_limit: 512m
    cpus: 1.0
    restart: unless-stopped
    logging:
      driver: json-file
      options: {max-size: 5m, max-file: '2'}
networks:
  egress: {}
  evidence:
    internal: true
volumes:
  cases: {}
secrets:
  osint_token:
    file: /ABSOLUTE/PRIVATE/PATH/osint-token
```

The app runs as UID 1000 and OCR as UID 10001. Provision the token through your approved secret store, with the mounted file readable by the intended runtime identity. The app reads `/run/secrets/osint_token`. Verify its dedicated `/data` volume is writable by UID 1000. Establish and exercise private backup/restore before retaining real evidence. Verify destination bind mounts directly; a remote Docker context may not share local paths.

`expose` documents the app port; the proxy must also share an appropriate app network. Coolify can configure service routing. Inspect its generated topology and keep OCR exclusively on the internal evidence network. Containers share a kernel, so these controls reduce exposure without guaranteeing safety against hostile image-decoder exploits.

## Managed-host network and storage differences

The tested Coolify 4.6.0 parser injects top-level/proxy networks into services using ordinary `networks`. To keep OCR isolated, give OCR `network_mode` naming the unique internal evidence bridge, `hostname: ocr`, and `traefik.enable=false`. Remove its `networks` field and supply no OCR URL or published ports. The app must also join this internal bridge so it can resolve `ocr`. A deployment must prove the worker has exactly that network and cannot connect outbound.

Replace uppercase placeholders below with unique approved names and subnets checked against all host routes and Docker networks. This is a schematic managed-host override, not a runnable configuration. Apply it to the complete confinement/limits template above through the management API, then inspect generated Compose:

```yaml
services:
  app:
    volumes:
      - cases:/data
      - type: bind
        source: /ABSOLUTE/PRIVATE/PATH/owner-token
        target: /run/secrets/osint_token
        read_only: true
        bind: {create_host_path: false}
    # Remove app.secrets; replace it with this reviewed file bind.
  ocr:
    hostname: ocr
    network_mode: YOUR_UNIQUE_INTERNAL_EVIDENCE_NETWORK
    labels: ['traefik.enable=false']
    # Remove networks entirely; do not merely append network_mode.
networks:
  evidence:
    name: YOUR_UNIQUE_INTERNAL_EVIDENCE_NETWORK
    internal: true
    ipam:
      config: [{subnet: YOUR_REVIEWED_EVIDENCE_CIDR}]
  egress:
    ipam:
      config: [{subnet: YOUR_REVIEWED_EGRESS_CIDR}]
volumes:
  cases:
    external: true
    name: YOUR_PREPROVISIONED_PRIVATE_CASE_VOLUME
```

Provision and initialize only the dedicated case volume as UID/GID 1000, mode 0700. Keep it external to the manager's deletion lifecycle. Provision the owner-token bind as a regular nonempty file readable by UID 1000, mode 0400, under a private directory. Never regenerate it on redeploy. Remove the unused top-level `secrets` declaration when switching to a bind.

The tested host exhausted Docker's default network pool on the first start, before any app containers existed. After checking non-overlap, the deployment used small explicit subnets and precreated only its own UUID proxy network with an approved subnet. Do not copy another host's ranges, delete unrelated networks or change daemon-wide pools to solve an application rollout.

Keep the existing ingress owner. If the origin uses a Cloudflare Origin CA certificate, the browser-facing hostname must use its configured Cloudflare proxy with Full (strict) origin validation. Direct browser trust of an Origin CA certificate is not expected. Do not bypass TLS validation to send credentials, weaken zone TLS or replace unrelated certificates.

## Optional Coolify API creation

The official [OpenAPI schema](https://raw.githubusercontent.com/coollabsio/coolify/v4.x/openapi.json) and [service controller](https://github.com/coollabsio/coolify/blob/v4.x/app/Http/Controllers/Api/ServicesController.php) define `POST /api/v1/services`. The owner pilot exercised create, stopped PATCH, start and restart against version 4.6.0. Recheck your installed schema before mutation. API acknowledgement is asynchronous; inspect deployment activity and actual container health before claiming completion.

Prepare this JSON in memory, replacing every uppercase placeholder. Base64-encode only reviewed production Compose YAML. Supply `docker_compose_raw` instead of a one-click `type`:

```json
{
  "name": "Alkamy OSINT - SuspectFraud",
  "description": "Private evidence cases, domain investigation and report preparation",
  "project_uuid": "YOUR_PROJECT_UUID",
  "environment_uuid": "YOUR_ENVIRONMENT_UUID",
  "server_uuid": "YOUR_SERVER_UUID",
  "destination_uuid": "YOUR_DESTINATION_UUID",
  "instant_deploy": false,
  "connect_to_docker_network": false,
  "force_domain_override": false,
  "redact_all_env_values_in_logs": true,
  "docker_compose_raw": "BASE64_OF_REVIEWED_PRODUCTION_COMPOSE",
  "urls": [{"name": "app", "url": "https://YOUR_OSINT_HOST:4321"}]
}
```

On the tested version, creation saved the app URL but did not generate route labels in the initial parsed Compose. A supported stopped-service PATCH with the same reviewed Compose regenerated routing. Read back the actual generated configuration, including exact Host/TLS/upstream labels; a saved FQDN alone is insufficient. Disable inherited default variables and inspect any materialized `.env` keys without exposing its values.

The URL's `:4321` identifies the internal app port. The public origin remains `https://YOUR_OSINT_HOST` on port 443. Read back the stopped resource and generated configuration before starting. Domain-conflict HTTP 409 is a hold; keep `force_domain_override` false. If creation has an unknown outcome, reconcile listed resources before retrying POST.

Use authenticated HTTPS management or encrypted SSH terminating at the manager with a loopback HTTP request. Keep bearer tokens in process memory or an approved runtime secret mechanism, absent from arguments, URLs, public files, logs and tool output. Emit only allowlisted non-secret fields. Successful reads do not establish mutation permission.

Coolify's [start action](https://github.com/coollabsio/coolify/blob/v4.x/app/Actions/Service/StartService.php) parses services and configures networks. The request flag alone does not prove OCR isolation. Inspect generated Compose and running network membership. If OCR receives egress or proxy connectivity, stop rollout and revise the deployment design.

## Foreground release controls

This release used a one-time foreground deployment with reviewed source/configuration, scoped runtime ownership and independent acceptance. It did not create a tracker issue tree, recurring worker schedule or coordination leases. The older procedure's recurring-job assumption was superseded by the host instruction excluding automations for one-time task completion. This is not a claim of full compliance with that older governed-worker procedure.

## Acceptance and rollback

Recheck capacity and hostname collisions immediately before rollout. Budget for both 512 MiB container limits, builds, existing workloads and memory headroom. Serialize builds and keep training offline. Create only the intended DNS record after verifying the target and any IPv6 support. Verify certificate issuance and HTTPS routing.

Accept deployment after healthy-container checks, allowed-host success, unexpected-host rejection, denied unauthenticated API/MCP calls, authenticated synthetic case/OCR/report flows through the public origin, bounded responses, private-case isolation and explicit training-consent behavior. Confirm OCR cannot reach the Internet from its actual container and has no public port. Check secrets and private case material are absent from logs, frontend assets and public source. The owner pilot passed these public-origin checks using synthetic evidence; repeat them for every installation.

Retain previous image references and configuration. Roll back images while preserving the evidence volume and owner token. For an initial release, stop only the new service and remove only its route, retaining private evidence for recovery. Rollback does not authorize deleting case data.
