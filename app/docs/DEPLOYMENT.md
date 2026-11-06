# Self-hosting SuspectFraud

Status: **tested local build; public deployment pending**. The app and OCR worker were exercised locally in constrained containers. A private preflight verified a compatible Coolify management API and candidate host. No remote service, DNS record, production token, image, volume or container was created or changed. Private infrastructure and credential references are excluded from this package.

## Runtime boundary

Deploy two containers: app port 4321 and OCR port 8080. Only the app receives public ingress through an HTTPS reverse proxy. The app needs controlled outbound access for domain research. OCR must have no outbound Internet access, public port or proxy-network connection. Neural training remains an optional offline process, excluded from production.

Retain owner-token authentication. Hosting does not create a public evidence submission service or multi-user access model. Set `PUBLIC_ORIGIN` to the exact external origin, without a path or internal port. The app checks Host and Origin. Allow sufficient API time for the OCR worker's 30-second deadline.

## Compose template

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

## Optional Coolify API creation

The official [OpenAPI schema](https://raw.githubusercontent.com/coollabsio/coolify/v4.x/openapi.json) and [service controller](https://github.com/coollabsio/coolify/blob/v4.x/app/Http/Controllers/Api/ServicesController.php) define `POST /api/v1/services`. Read-only preflight verified version 4.6.0; create was not exercised. Recheck the installed schema before mutation.

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

The URL's `:4321` identifies the internal app port. The public origin remains `https://YOUR_OSINT_HOST` on port 443. Read back the stopped resource and generated configuration before starting. Domain-conflict HTTP 409 is a hold; keep `force_domain_override` false. If creation has an unknown outcome, reconcile listed resources before retrying POST.

Use authenticated HTTPS management or encrypted SSH terminating at the manager with a loopback HTTP request. Keep bearer tokens in process memory or an approved runtime secret mechanism, absent from arguments, URLs, public files, logs and tool output. Emit only allowlisted non-secret fields. Successful reads do not establish mutation permission.

Coolify's [start action](https://github.com/coollabsio/coolify/blob/v4.x/app/Actions/Service/StartService.php) parses services and configures networks. The request flag alone does not prove OCR isolation. Inspect generated Compose and running network membership. If OCR receives egress or proxy connectivity, stop rollout and revise the deployment design.

## This release's governance hold

The development workflow's Node deployment procedure states:

> Delivery continues only with a tracker DEAL project, parent and subissues, a verified AI schedule in the requested controller mode, a live `plane-<IDENT>` coordination lease, and live caller-provided leases for every repository, service path, Compose project, route, or other mutable resource this issue will change. Otherwise return `governance missing` listing the absent controls.

Source: `creating-mcp-servers/reference/how-the-node-path-deploys-services.md`, step 4, Governance gate. The tracker issue tree, verified schedule and live issue/resource leases were not established for this release. Resolve them in the existing delivery workflow before production or DNS mutation. This is a release-workflow requirement, separate from runtime dependencies.

## Acceptance and rollback

Recheck capacity and hostname collisions immediately before rollout. Budget for both 512 MiB container limits, builds, existing workloads and memory headroom. Serialize builds and keep training offline. Create only the intended DNS record after verifying the target and any IPv6 support. Verify certificate issuance and HTTPS routing.

Accept deployment after healthy-container checks, allowed-host success, unexpected-host rejection, denied unauthenticated API/MCP calls, authenticated synthetic case/OCR/report flows through the public origin, bounded responses, private-case isolation and explicit training-consent behavior. Confirm OCR cannot reach the Internet from its actual container and has no public port. Check secrets and private case material are absent from logs, frontend assets and public source. Public-origin checks remain pending.

Retain previous image references and configuration. Roll back images while preserving the evidence volume and owner token. For an initial release, stop only the new service and remove only its route, retaining private evidence for recovery. Rollback does not authorize deleting case data.
