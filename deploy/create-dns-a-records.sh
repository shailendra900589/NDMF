#!/usr/bin/env bash
# Create A records for ndclients.co.in → EC2 public IP (run ON the EC2 box)
# Requires: AWS CLI + IAM permission route53:ChangeResourceRecordSets (or admin)
set -euo pipefail

DOMAIN="${DOMAIN:-ndclients.co.in}"
IP="${IP:-13.60.224.155}"

echo "==> Installing awscli if needed"
if ! command -v aws >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y awscli
fi

echo "==> Checking AWS identity"
if ! aws sts get-caller-identity; then
  echo ""
  echo "FAIL: EC2 has no AWS credentials / IAM role."
  echo "Fix Option A — AWS Console (easiest):"
  echo "  Route 53 → Hosted zones → ${DOMAIN} → Create record"
  echo "  A  @    → ${IP}"
  echo "  A  www  → ${IP}"
  echo ""
  echo "Fix Option B — attach IAM role to this instance with Route53 access, then re-run:"
  echo "  bash deploy/create-dns-a-records.sh"
  exit 1
fi

echo "==> Find hosted zone for ${DOMAIN}"
ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${DOMAIN}." \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id | [0]" \
  --output text)

if [[ -z "${ZONE_ID}" || "${ZONE_ID}" == "None" ]]; then
  echo "FAIL: No hosted zone found for ${DOMAIN}"
  echo "Create one in Route 53 → Hosted zones → Create hosted zone → ${DOMAIN}"
  exit 1
fi

# /hostedzone/ZXXXXXXXX → ZXXXXXXXX
ZONE_ID="${ZONE_ID##*/}"
echo "Zone ID: ${ZONE_ID}"

TMP=$(mktemp)
cat >"${TMP}" <<EOF
{
  "Comment": "NDFA point ${DOMAIN} to ${IP}",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{ "Value": "${IP}" }]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.${DOMAIN}",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{ "Value": "${IP}" }]
      }
    }
  ]
}
EOF

echo "==> UPSERT A records"
aws route53 change-resource-record-sets \
  --hosted-zone-id "${ZONE_ID}" \
  --change-batch "file://${TMP}"

rm -f "${TMP}"

echo ""
echo "DONE. Wait 1–5 min, then:"
echo "  dig +short ${DOMAIN} A"
echo "  dig +short www.${DOMAIN} A"
echo "Expect: ${IP}"
echo ""
echo "Then SSL:"
echo "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN} --redirect"
