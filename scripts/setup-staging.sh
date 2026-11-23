#!/bin/bash
set -e

echo "=== PenGovR Staging Environment Setup ==="

# 1. Networks を作成
echo "Creating Docker networks..."
docker network create pengovr-private 2>/dev/null || echo "Network pengovr-private already exists"
docker network create pengovr-external 2>/dev/null || echo "Network pengovr-external already exists"

# 2. Jenkins + Registry を起動
echo "Starting Jenkins and Docker Registry..."
docker compose -f jenkins/docker-compose.jenkins.yml up -d --build

echo ""
echo "✓ Setup complete!"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Jenkins is running at: http://localhost:8080"
echo ""
echo "2. Get the initial Jenkins admin password:"
echo "   docker compose -f jenkins/docker-compose.jenkins.yml exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword"
echo ""
echo "3. Configure Jenkins:"
echo "   - Install suggested plugins"
echo "   - Create admin user"
echo "   - Create a new Pipeline job pointing to your git repository"
echo ""
echo "4. Set up Jenkins:"
echo "   - Create a Pipeline job"
echo "   - In 'Pipeline' section, select 'Pipeline script' and paste"
echo "   - jenkins/Jenkinsfile.private (for private network)"
echo "   - Or jenkins/Jenkinsfile.external (for external network)"
echo ""
echo "5. Docker Registry is running at: localhost:5000"
echo ""
echo "6. Environment file (.env) path:"
echo "   ${PWD}/.env"
echo ""

