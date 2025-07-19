# Migration Guide: From Single Server to Scalable Architecture

## Overview
This guide walks through migrating from the single-instance server to the scalable, multi-region architecture.

## Key Improvements

### 1. **Horizontal Scalability**
- Multiple server instances can run simultaneously
- Load balanced with sticky sessions for WebSocket connections
- Auto-scaling based on CPU/memory usage

### 2. **Redis Integration**
- Distributed session storage
- Cross-server communication via pub/sub
- Persistent room and peer state

### 3. **High Availability**
- No single point of failure
- Automatic failover
- Health checks and monitoring

### 4. **Multi-Region Support**
- Deploy servers in multiple regions
- Route users to nearest server
- Cross-region communication via Redis

## Migration Steps

### Step 1: Set Up Redis
```bash
# For development
docker run -d --name pantheon-redis -p 6379:6379 redis:7-alpine

# For production (AWS ElastiCache, Redis Cloud, etc.)
# Configure Redis cluster with persistence and replication
```

### Step 2: Update Environment Variables
```bash
# Add to .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
SERVER_REGION=us-east
```

### Step 3: Test Locally
```bash
# Start Redis
docker-compose -f docker-compose-scalable.yml up redis

# Start multiple server instances
SERVER_ID=server-1 PORT=3001 node server-scalable.js &
SERVER_ID=server-2 PORT=3002 node server-scalable.js &
```

### Step 4: Deploy with Docker Compose
```bash
# Build and start all services
docker-compose -f docker-compose-scalable.yml up --build
```

### Step 5: Deploy to Kubernetes
```bash
# Create namespace and deploy
kubectl apply -f k8s-deployment.yaml

# Check deployment status
kubectl get pods -n pantheon
kubectl get svc -n pantheon
```

## Client Updates

No client changes required! The scalable server maintains backward compatibility.

## Monitoring

### Health Checks
- `/health` - Server health and stats
- `/metrics` - Prometheus-compatible metrics

### Recommended Monitoring Stack
1. **Prometheus** - Metrics collection
2. **Grafana** - Visualization dashboards
3. **AlertManager** - Alerting rules

### Key Metrics to Monitor
- WebSocket connections per server
- Room distribution across servers
- Redis connection pool usage
- Cross-server message latency
- CPU/Memory usage per pod

## Performance Tuning

### Redis Configuration
```redis
# Optimize for real-time communication
timeout 0
tcp-keepalive 60
maxclients 10000
```

### Node.js Configuration
```javascript
// Increase WebSocket limits
io.engine.opts.maxHttpBufferSize = 1e6; // 1MB
io.engine.opts.pingTimeout = 60000;
io.engine.opts.pingInterval = 25000;
```

### Load Balancer Configuration
- Enable session affinity (sticky sessions)
- Set appropriate timeouts for WebSocket connections
- Configure health check intervals

## Rollback Plan

If issues arise:
1. Keep original server.js running on separate port
2. Gradually migrate traffic using weighted load balancing
3. Monitor error rates and performance metrics
4. Full rollback: Update client connection URLs

## Security Considerations

1. **Redis Security**
   - Always use password authentication
   - Enable TLS for production
   - Restrict network access

2. **Inter-Server Communication**
   - Use VPC/private networking
   - Implement message validation
   - Rate limiting per connection

## Cost Optimization

1. **Auto-scaling Rules**
   - Scale down during low traffic
   - Regional deployment based on user distribution

2. **Redis Optimization**
   - Use Redis memory policies
   - Implement key expiration
   - Monitor memory usage

## Troubleshooting

### Common Issues

1. **WebSocket Connection Drops**
   - Check load balancer timeout settings
   - Verify sticky session configuration

2. **Cross-Server Signaling Fails**
   - Check Redis pub/sub connectivity
   - Verify server IDs are unique

3. **High Memory Usage**
   - Implement connection limits
   - Add Redis key expiration
   - Monitor for memory leaks