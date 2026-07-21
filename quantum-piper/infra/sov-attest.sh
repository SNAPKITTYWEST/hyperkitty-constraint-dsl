#!/bin/bash
# sov-attest.sh : Bifrost WORM-Chain Attestation Wrapper
set -euo pipefail

IMAGE_NAME="${1:?Usage: sov-attest.sh <image-name>}"
BIFROST_KEY="/etc/sov/ed25519.priv"
WORM_FILE="${IMAGE_NAME//\//_}.worm"

echo "[+] Initiating SOV-KERNEL-MONSTER Attestation for: $IMAGE_NAME"

# 1. Blake3 hash of the image tar stream
HASH=$(docker save "$IMAGE_NAME" | b3sum --no-names)
echo "[ATTESTATION] Blake3: $HASH"

# 2. Sign with Ed25519
echo -n "$HASH" | openssl pkeyutl -sign -inkey "$BIFROST_KEY" -out "${HASH}.sig"
SIGNATURE=$(base64 -w0 "${HASH}.sig")
rm -f "${HASH}.sig"

# 3. Write WORM sidecar
cat > "$WORM_FILE" <<EOF
{
  "image": "$IMAGE_NAME",
  "hash": "$HASH",
  "signature": "$SIGNATURE",
  "protocol": "Bifrost_WORM_v2026"
}
EOF

echo "[WORM] Seal written: $WORM_FILE"

# 4. Push to sovereign registry only after seal
docker tag "$IMAGE_NAME" "localhost:5000/$IMAGE_NAME"
docker push "localhost:5000/$IMAGE_NAME"

echo "[+] SEALED and PUSHED: $IMAGE_NAME -> sov-registry"
