# n8n image (azure-deploy AC-4). Build from the repo root:  docker build -f n8n/Dockerfile -t cv-n8n .
# The Docker dev setup bind-mounts n8n/setup and n8n/workflows; a container platform has no bind mounts, so they are baked in.
# Same entrypoint as dev: owner + credentials from the environment, import and publish the workflows, then start n8n.
# No secret in the image: every secret comes from the environment (see docs/features/azure-deploy/runbook.md).
FROM n8nio/n8n:2.46.6
COPY --chown=node:node n8n/setup /setup
COPY --chown=node:node n8n/workflows /workflows
ENTRYPOINT ["tini", "--", "sh", "/setup/entrypoint.sh"]
