#!/bin/bash

API_URL="http://localhost:3000"
CUSTOMER_ID="cust_123"
MEMBERSHIP_ID="mem_123"

# Colors
GREEN='\039[0;32m'
NC='\039[0m'

echo -e "${GREEN}1. Creating a Request...${NC}"
CREATE_RES=$(curl -s -X POST "$API_URL/requests" \
  -H "Content-Type: application/json" \
  -H "x-customer-id: $CUSTOMER_ID" \
  -d '{
    "title": "Need a new laptop",
    "description": "My current laptop is very slow.",
    "category": "IT",
    "priority": "high",
    "created_by_membership_id": "'$MEMBERSHIP_ID'"
  }')

echo $CREATE_RES | jq .
REQ_ID=$(echo $CREATE_RES | jq -r '.request.id')
echo ""

echo -e "${GREEN}2. Fetching the Thread for the Request...${NC}"
curl -s -X GET "$API_URL/requests/$REQ_ID/thread" \
  -H "x-customer-id: $CUSTOMER_ID" | jq .
echo ""

echo -e "${GREEN}3. Adding a comment to the Thread...${NC}"
curl -s -X POST "$API_URL/requests/$REQ_ID/messages" \
  -H "Content-Type: application/json" \
  -H "x-customer-id: $CUSTOMER_ID" \
  -d '{
    "body": "Can you specify which OS you prefer?",
    "sender_membership_id": "'$MEMBERSHIP_ID'"
  }' | jq .
echo ""

echo -e "${GREEN}4. Transitioning Request from draft -> submitted...${NC}"
curl -s -X POST "$API_URL/requests/$REQ_ID/transition" \
  -H "Content-Type: application/json" \
  -H "x-customer-id: $CUSTOMER_ID" \
  -d '{
    "transitionKey": "submit_request",
    "actorType": "customer",
    "actorId": "'$MEMBERSHIP_ID'"
  }' | jq .
echo ""

echo -e "${GREEN}5. Fetching the Thread again to see State Change System Message...${NC}"
curl -s -X GET "$API_URL/requests/$REQ_ID/thread" \
  -H "x-customer-id: $CUSTOMER_ID" | jq .
echo ""

echo -e "${GREEN}6. Fetching the Request definition...${NC}"
curl -s -X GET "$API_URL/requests/$REQ_ID" \
  -H "x-customer-id: $CUSTOMER_ID" | jq .
echo ""
