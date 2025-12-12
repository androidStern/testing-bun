#!/bin/bash

# Test SMS to production Convex endpoint
# Usage: ./scripts/test-sms.sh "Your job posting text here"

BODY="${1:-Hiring Software Engineer at TestCo. \$150k remote. React and Node required. Email jobs@testco.com}"
PHONE="${2:-+15559998888}"
MESSAGE_SID="SM$(date +%s)"

curl -s -X POST "https://amiable-dove-3.convex.site/webhooks/twilio-sms" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$PHONE" \
  --data-urlencode "Body=$BODY" \
  --data-urlencode "MessageSid=$MESSAGE_SID"

echo ""
echo "Sent SMS from $PHONE with MessageSid=$MESSAGE_SID"
