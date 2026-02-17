#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service configurations with their ports
declare -A SERVICES=(
    ["api-gateway"]="8080"
    ["auth-service"]="6001"
    ["product-service"]="6002"
    ["order-service"]="6003"
    ["seller-service"]="6004"
    ["admin-service"]="6005"
    ["chatting-service"]="6006"
    ["kafka-service"]="6007"
    ["logger-service"]="6008"
    ["recommendation-service"]="6009"
)

declare -A UI_SERVICES=(
    ["user-ui"]="3000"
    ["seller-ui"]="3001"
    ["admin-ui"]="3002"
)

# Function to print usage
print_usage() {
    echo -e "${BLUE}Local Production Environment Script${NC}"
    echo -e "${BLUE}Usage: $0 [OPTIONS]${NC}"
    echo -e "${BLUE}Options:${NC}"
    echo -e "  -b, --build-only           Build and test all services (no run)"
    echo -e "  -r, --run-only              Run existing Docker images"
    echo -e "  -s, --stop                  Stop all running containers"
    echo -e "  -c, --clean                 Clean all containers and images"
    echo -e "  -l, --logs <service>        Show logs for specific service"
    echo -e "  -S, --service <service>      Build Docker image for a specific service"
    echo -e "  -h, --help                  Show this help message"
    echo -e "\n${BLUE}Default: Build, test, and run all services${NC}"
}

# Function to load environment variables
load_env_vars() {
    if [ -f ".env" ]; then
        echo -e "${BLUE}Loading environment variables from .env file...${NC}"
        export $(grep -v '^#' .env | xargs)
    else
        echo -e "${YELLOW}Warning: .env file not found. Using default values.${NC}"
    fi
}

# Function to stop all running containers
stop_all_containers() {
    echo -e "${YELLOW}Stopping all running containers...${NC}"
    
    # Stop all service containers
    for service in "${!SERVICES[@]}"; do
        if docker ps -q -f name="$service" | grep -q .; then
            echo -e "${BLUE}Stopping $service...${NC}"
            docker stop "$service" 2>/dev/null
            docker rm "$service" 2>/dev/null
        fi
    done
    
    # Stop all UI containers
    for ui in "${!UI_SERVICES[@]}"; do
        if docker ps -q -f name="$ui" | grep -q .; then
            echo -e "${BLUE}Stopping $ui...${NC}"
            docker stop "$ui" 2>/dev/null
            docker rm "$ui" 2>/dev/null
        fi
    done
    
    echo -e "${GREEN}✅ All containers stopped${NC}"
}

# Function to clean all containers and images
clean_all() {
    echo -e "${YELLOW}Cleaning all containers and images...${NC}"
    
    stop_all_containers
    
    # Remove all service images
    for service in "${!SERVICES[@]}"; do
        if docker images -q "$service:latest" | grep -q .; then
            echo -e "${BLUE}Removing $service image...${NC}"
            docker rmi "$service:latest" 2>/dev/null
        fi
    done
    
    # Remove all UI images
    for ui in "${!UI_SERVICES[@]}"; do
        if docker images -q "$ui:latest" | grep -q .; then
            echo -e "${BLUE}Removing $ui image...${NC}"
            docker rmi "$ui:latest" 2>/dev/null
        fi
    done
    
    # Clean up dangling images
    docker image prune -f
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Function to build and test all services
build_and_test_all() {
    echo -e "${BLUE}🚀 Starting build and test process...${NC}"
    
    # Run the existing local-ci.sh script
    if [ -f "scripts/local-ci.sh" ]; then
        echo -e "${BLUE}Running local-ci.sh for build and test...${NC}"
        bash scripts/local-ci.sh --all
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Build and test failed. Aborting.${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ All services built and tested successfully${NC}"
    else
        echo -e "${RED}❌ local-ci.sh not found in scripts directory${NC}"
        exit 1
    fi
}

# Function to run all services
run_all_services() {
    echo -e "${BLUE}🚀 Starting all services in production mode...${NC}"
    
    load_env_vars
    
    # Create a network for inter-service communication
    if ! docker network ls | grep -q "eshop-network"; then
        echo -e "${BLUE}Creating Docker network...${NC}"
        docker network create eshop-network
    fi
    
    # Start backend services first
    echo -e "${YELLOW}Starting backend services...${NC}"
    for service in "${!SERVICES[@]}"; do
        port="${SERVICES[$service]}"
        echo -e "${BLUE}Starting $service on port $port...${NC}"
        
        docker run -d \
            --name "$service" \
            --network eshop-network \
            -p "$port:$port" \
            --env-file .env \
            --restart unless-stopped \
            "$service:latest"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ $service started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start $service${NC}"
        fi
    done
    
    # Wait a bit for backend services to initialize
    echo -e "${YELLOW}Waiting for backend services to initialize...${NC}"
    sleep 10
    
    # Start UI services
    echo -e "${YELLOW}Starting UI services...${NC}"
    for ui in "${!UI_SERVICES[@]}"; do
        port="${UI_SERVICES[$ui]}"
        echo -e "${BLUE}Starting $ui on port $port...${NC}"
        
        docker run -d \
            --name "$ui" \
            --network eshop-network \
            -p "$port:$port" \
            --env-file .env \
            --restart unless-stopped \
            "$ui:latest"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ $ui started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start $ui${NC}"
        fi
    done
    
    echo -e "${GREEN}🎉 All services are running!${NC}"
    show_service_status
}

# Function to show service status and URLs
show_service_status() {
    echo -e "\n${BLUE}📊 Service Status:${NC}"
    echo -e "${BLUE}==================${NC}"
    
    echo -e "\n${YELLOW}🌐 Frontend Applications:${NC}"
    for ui in "${!UI_SERVICES[@]}"; do
        port="${UI_SERVICES[$ui]}"
        if docker ps -q -f name="$ui" | grep -q .; then
            echo -e "  ✅ $ui: http://localhost:$port"
        else
            echo -e "  ❌ $ui: Not running"
        fi
    done
    
    echo -e "\n${YELLOW}🔧 Backend Services:${NC}"
    for service in "${!SERVICES[@]}"; do
        port="${SERVICES[$service]}"
        if docker ps -q -f name="$service" | grep -q .; then
            echo -e "  ✅ $service: http://localhost:$port"
        else
            echo -e "  ❌ $service: Not running"
        fi
    done
    
    echo -e "\n${BLUE}💡 Quick Commands:${NC}"
    echo -e "  View logs: $0 --logs <service-name>"
    echo -e "  Stop all: $0 --stop"
    echo -e "  Clean all: $0 --clean"
}

# Function to show logs for a specific service
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}❌ Please specify a service name${NC}"
        exit 1
    fi
    
    if docker ps -q -f name="$service" | grep -q .; then
        echo -e "${BLUE}📋 Showing logs for $service (Press Ctrl+C to exit):${NC}"
        docker logs -f "$service"
    else
        echo -e "${RED}❌ Service $service is not running${NC}"
    fi
}

build_specific_service() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}❌ Please specify a service name with --service <service-name>${NC}"
        exit 1
    fi
    if [ -f "apps/$service/Dockerfile" ]; then
        echo -e "${BLUE}Building Docker image for $service...${NC}"
        docker build -t "$service:latest" -f "apps/$service/Dockerfile" .
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ $service image built successfully${NC}"
        else
            echo -e "${RED}❌ Failed to build $service image${NC}"
        fi
    else
        echo -e "${RED}❌ Dockerfile not found for $service in apps/$service${NC}"
        exit 1
    fi
}

# Main script logic
case "$1" in
    -b|--build-only)
        build_and_test_all
        ;;
    -r|--run-only)
        run_all_services
        ;;
    -s|--stop)
        stop_all_containers
        ;;
    -c|--clean)
        clean_all
        ;;
    -l|--logs)
        show_logs "$2"
        ;;
    -S|--service)
        build_specific_service "$2"
        ;;
    -h|--help)
        print_usage
        ;;
    "")
        # Default: build, test, and run
        build_and_test_all
        run_all_services
        ;;
    *)
        echo -e "${RED}❌ Unknown option: $1${NC}"
        print_usage
        exit 1
        ;;
esac