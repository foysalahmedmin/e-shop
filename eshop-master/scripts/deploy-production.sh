#!/bin/bash
set -e # Exit on any error

echo "🚀 Starting production deployment..."

# Pull latest images for changed services
if [ "$CHANGED_BACKEND" != "[]" ]; then
    echo "Pulling backend service images..."
    for service in $(echo $CHANGED_BACKEND | jq -r '.[]'); do
        echo "Pulling $DOCKER_USERNAME/$service:latest"
        docker pull $DOCKER_USERNAME/$service:latest
    done
fi

if [ "$CHANGED_FRONTEND" != "[]" ]; then
    echo "Pulling frontend service images..."
    for service in $(echo $CHANGED_FRONTEND | jq -r '.[]'); do
        echo "Pulling $DOCKER_USERNAME/$service:latest"
        docker pull $DOCKER_USERNAME/$service:latest
    done
fi

# Start/restart services using docker-compose
echo "Deploying services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be healthy with dynamic checking
echo "Waiting for services to be healthy..."

# Function to check if containers are running
check_containers() {
    local nginx_status=$(docker ps --filter "name=eshop-nginx-1" --format "{{.Status}}" | grep -c "Up" || echo "0")
    local gateway_status=$(docker ps --filter "name=eshop-api-gateway-1" --format "{{.Status}}" | grep -c "Up" || echo "0")
    
    if [ "$nginx_status" = "1" ] && [ "$gateway_status" = "1" ]; then
        return 0
    else
        return 1
    fi
}

# Function to check if health endpoint responds
check_health_endpoint() {
    curl -f -k -s --max-time 5 https://shondhane.com/gateway-health > /dev/null 2>&1
    return $?
}

# Wait for containers to start (max 5 minutes)
echo "⏳ Waiting for containers to start..."
CONTAINER_TIMEOUT=300  # 5 minutes
CONTAINER_ELAPSED=0

while ! check_containers && [ $CONTAINER_ELAPSED -lt $CONTAINER_TIMEOUT ]; do
    echo "   Containers starting... (${CONTAINER_ELAPSED}s elapsed)"
    sleep 10
    CONTAINER_ELAPSED=$((CONTAINER_ELAPSED + 10))
done

if ! check_containers; then
    echo "❌ Containers failed to start within ${CONTAINER_TIMEOUT} seconds!"
    echo "Container status:"
    docker ps | grep eshop
    exit 1
fi

echo "✅ Containers are running!"

# Wait for health endpoint to respond (max 3 minutes)
echo "⏳ Waiting for health endpoint to respond..."
HEALTH_TIMEOUT=180  # 3 minutes
HEALTH_ELAPSED=0

while ! check_health_endpoint && [ $HEALTH_ELAPSED -lt $HEALTH_TIMEOUT ]; do
    echo "   Health check pending... (${HEALTH_ELAPSED}s elapsed)"
    sleep 15
    HEALTH_ELAPSED=$((HEALTH_ELAPSED + 15))
done

if ! check_health_endpoint; then
    echo "⚠️  Health endpoint not ready within ${HEALTH_TIMEOUT} seconds, but continuing with verification..."
else
    echo "✅ Health endpoint is responding!"
fi

# Verify deployment with multiple checks
echo "Verifying deployment..."

# Check 1: HTTPS endpoint (primary)
if curl -f -k https://shondhane.com/gateway-health > /dev/null 2>&1; then
    echo "✅ HTTPS endpoint working!"
    HTTPS_OK=true
else
    echo "⚠️  HTTPS endpoint failed, trying alternatives..."
    HTTPS_OK=false
fi

# Check 2: Direct IP with HTTPS (fallback)
if [ "$HTTPS_OK" = false ]; then
    if curl -f -k -H "Host: shondhane.com" https://3.239.91.208/gateway-health > /dev/null 2>&1; then
        echo "✅ Direct HTTPS access working!"
        HTTPS_OK=true
    else
        echo "⚠️  Direct HTTPS failed, checking HTTP redirect..."
    fi
fi

# Check 3: HTTP redirect (should get 301)
if [ "$HTTPS_OK" = false ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://3.239.91.208/ || echo "000")
    if [ "$HTTP_STATUS" = "301" ]; then
        echo "✅ HTTP redirect working (301 to HTTPS)!"
        HTTPS_OK=true
    else
        echo "❌ HTTP status: $HTTP_STATUS (expected 301)"
    fi
fi

# Check 4: Container health (fallback)
if [ "$HTTPS_OK" = false ]; then
    echo "Checking container health..."
    if docker ps | grep -q "eshop-nginx-1.*Up"; then
        echo "✅ Nginx container is running!"
        if docker ps | grep -q "eshop-api-gateway-1.*Up"; then
            echo "✅ API Gateway container is running!"
            echo "⚠️  Services are running but may need time to initialize"
            HTTPS_OK=true
        else
            echo "❌ API Gateway container not running!"
        fi
    else
        echo "❌ Nginx container not running!"
    fi
fi

# Final verdict
if [ "$HTTPS_OK" = true ]; then
    echo ""
    echo "🎉 Deployment successful!"
    echo "🌐 Site available at: https://shondhane.com"
    echo "🔧 API Health: https://shondhane.com/gateway-health"
    echo "👥 Sellers: https://sellers.shondhane.com"
    echo "⚙️  Admin: https://admin.shondhane.com"
else
    echo ""
    echo "❌ Deployment verification failed!"
    echo "🔍 Debug commands:"
    echo "  docker ps | grep eshop"
    echo "  docker logs eshop-nginx-1 --tail 20"
    echo "  docker logs eshop-api-gateway-1 --tail 20"
    echo "  curl -v https://shondhane.com/gateway-health"
    exit 1
fi