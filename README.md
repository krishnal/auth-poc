# AWS Cognito Authentication PoC

A proof-of-concept authentication system demonstrating AWS Cognito integration with React frontend and Node.js backend. This PoC showcases dual authentication patterns: traditional email/password via Cognito and Google OAuth with custom token handling.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   React SPA     │    │   API Gateway    │    │   Lambda Functions  │
│   (Frontend)    │◄──►│   + Cognito      │◄──►│   (Authorizer +     │
│                 │    │   Authorizer     │    │    Business Logic)  │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         │                        │                         │
         │                        │                         │
         ▼                        ▼                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   AWS Cognito   │    │   Google OAuth   │    │   Node.js/Fastify   │
│   User Pool     │    │   Provider       │    │   Backend Services  │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

## 🚀 Features Demonstrated

- **Dual Authentication Patterns**: Email/password (Cognito) and Google OAuth
- **Custom Token Handling**: Google OAuth with custom token format for Lambda authorizer
- **JWT Token Management**: Token verification and user context extraction
- **Lambda Authorizer**: Unified authorization for both Cognito and Google tokens
- **React SPA**: Modern frontend with authentication flows
- **Infrastructure as Code**: AWS CDK deployment automation
- **Local Development**: Docker Compose setup for development
- **Environment Agnostic Auth**: Works both locally and on AWS

## 🎯 PoC Objectives

This proof-of-concept demonstrates:
1. **Hybrid Authentication**: Combining AWS Cognito with third-party OAuth providers
2. **Custom Token Strategy**: Handling non-Cognito tokens in AWS Lambda authorizers
3. **Unified User Experience**: Seamless auth flow regardless of provider
4. **Development-to-AWS Pipeline**: Consistent behavior across environments

## 📁 Project Structure

```
auth-poc/
├── infrastructure/          # AWS CDK Infrastructure
│   ├── lib/
│   │   └── auth-poc-stack.ts
│   ├── bin/
│   │   └── auth-poc.ts
│   └── package.json
├── backend/                # Node.js Backend
│   ├── src/
│   │   ├── handlers/       # Lambda functions
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   └── package.json
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   └── package.json
├── docker-compose.yml      # Local development
├── Makefile               # Build scripts
└── README.md
```

## 🛠️ Prerequisites

- **Node.js 22+** 
- **AWS CLI** configured with appropriate permissions
- **Docker & Docker Compose** for local development
- **AWS CDK CLI**: `npm install -g aws-cdk`
- **Google Cloud Console project** with OAuth 2.0 credentials
- **AWS Account** with sufficient permissions for Cognito, Lambda, API Gateway

## ⚡ Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd auth-poc
```

### 2. Setup Environment

Create a `.env` file in the project root:

```bash
# Create .env file
cat > .env << 'EOF'
# AWS Configuration
AWS_REGION=us-west-2
AWS_PROFILE=default
CDK_DEFAULT_ACCOUNT=your-aws-account-id
CDK_DEFAULT_REGION=us-west-2

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cognito (will be populated after CDK deployment)
COGNITO_USER_POOL_ID=us-west-2_XXXXXXXXX
COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_CLIENT_SECRET=your-cognito-client-secret

# Development Stage
STAGE=dev
EOF
```

**⚠️ Important**: Update the `.env` file with your actual AWS account ID and Google OAuth credentials before proceeding.

### 3. Install Dependencies

```bash
make install
```

### 4. Start Local Development

```bash
make dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### 5. Deploy to AWS (Optional)

```bash
# Bootstrap CDK (one-time setup per AWS account/region)
make bootstrap

# Deploy to development environment
make deploy-dev
```

After deployment, update your `.env` file with the Cognito values from the CDK output:
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID` 
- `COGNITO_CLIENT_SECRET`

Then restart your local development environment to use the deployed Cognito resources.

## 🧪 Testing

```bash
# Run all tests
make test

# Run backend tests only
cd backend && npm test

# Run frontend tests only  
cd frontend && npm test

# Run tests with coverage
cd backend && npm test -- --coverage
cd frontend && npm test -- --coverage --watchAll=false
```

**Current Test Coverage:**
- Backend: Basic unit tests for AuthService and authorization logic
- Frontend: Component tests for authentication flows
- **Note**: This is a PoC with fundamental test coverage, not comprehensive test suite

## 🔧 Development Commands

```bash
# Install all dependencies
make install

# Start development environment
make dev

# Stop development environment
make dev-stop

# View logs
make dev-logs

# Build all services
make build

# Lint code
make lint

# Fix linting issues
make lint-fix

# Deploy to development
make deploy-dev

# Deploy to production
make deploy-prod

# Clean build artifacts
make clean
```

## 🏗️ AWS Resources Created

The CDK stack (`AuthPocStack`) creates:

- **Cognito User Pool**: User management with email/password authentication
- **Cognito User Pool Client**: App client with OAuth settings for Google integration
- **Google Identity Provider**: Federated identity configuration
- **Lambda Authorizer**: Custom authorizer for dual token validation
- **Lambda Backend**: Fastify API handlers for authentication endpoints
- **API Gateway**: REST API with custom authorizer integration
- **IAM Roles**: Lambda execution roles with minimal permissions
- **CloudWatch Log Groups**: Logging for Lambda functions

**Resource Naming**: All resources are prefixed with `auth-poc-${stage}` for easy identification.

## 🔐 Security Features Implemented

### Authentication
- **JWT Token Validation**: Cognito and custom Google token verification
- **Dual Token Support**: Handles both Cognito JWTs and custom Google tokens
- **Token Expiry**: Automatic token expiration checking
- **Input Validation**: TypeScript interfaces for request validation

### AWS Security
- **IAM Roles**: Minimal permissions for Lambda functions
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **HTTPS Endpoints**: API Gateway with TLS encryption
- **Environment Isolation**: Separate stacks for dev/prod environments

### PoC Limitations
⚠️ **This is a PoC - Additional security measures needed for production:**
- Rate limiting and DDoS protection
- Comprehensive input sanitization  
- Security headers (HSTS, CSP, etc.)
- Monitoring and alerting
- Vulnerability scanning
- Secrets management (AWS Secrets Manager)

## 📊 Monitoring & Observability

### Current Implementation
- **CloudWatch Logs**: Lambda function logs with context
- **Structured Logging**: JSON format with request correlation
- **Basic Metrics**: Lambda execution time and error rates via CloudWatch
- **Console Debugging**: Detailed logging for development troubleshooting

### Production Considerations
For production deployment, consider adding:
- Application-specific metrics (auth success/failure rates)
- Custom CloudWatch dashboards
- Alarms for error rates and latency
- Distributed tracing (AWS X-Ray)
- Log aggregation and analysis tools

## 🔄 CI/CD Pipeline

Automated GitHub Actions workflow (`.github/workflows/ci-cd.yml`):

### Pipeline Stages
1. **Test Job**: 
   - Linting (ESLint)
   - Unit tests (Jest)
   - Build verification
   - Coverage reporting

2. **Security Scan**: 
   - Trivy vulnerability scanning
   - SARIF results upload

3. **Deploy Dev**: 
   - Triggers on `develop` branch
   - Automatic CDK deployment

4. **Deploy Prod**: 
   - Triggers on `main` branch  
   - Manual approval required (production environment)

### Required GitHub Secrets
```bash
# Development & Shared
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

# Production
AWS_ACCESS_KEY_ID_PROD
AWS_SECRET_ACCESS_KEY_PROD
GOOGLE_CLIENT_ID_PROD
GOOGLE_CLIENT_SECRET_PROD
```

**Note**: Update the AWS region in `.github/workflows/ci-cd.yml` from `us-east-1` to `us-west-2` to match your deployment region.

## 🌐 API Endpoints

### Public Endpoints
- `POST /auth/login` - Email/password authentication
- `POST /auth/signup` - User registration
- `POST /auth/google` - Google OAuth authentication
- `POST /auth/refresh` - Token refresh
- `POST /auth/password/forgot` - Password reset request
- `POST /auth/password/reset` - Password reset confirmation

### Protected Endpoints (require authentication)
- `GET /api/user` - Get user profile
- `PUT /api/user` - Update user profile
- `GET /api/data` - Get protected data

## 🔧 Configuration

### Environment-Specific Configuration

#### Development
- Local database connections
- Debug logging enabled
- CORS configured for localhost
- Hot reloading enabled

#### Production
- RDS/DynamoDB connections
- Error-level logging
- CDN for static assets
- Auto-scaling enabled

## 📈 Architecture Considerations

### Current PoC Limitations
- **Cold Starts**: Lambda functions may experience cold start latency
- **No Caching**: API responses are not cached
- **Single Region**: Deployed to one AWS region only
- **Basic Error Handling**: Minimal retry logic and fallback strategies

### Production Scalability Path
For production deployment, consider:
- **Provisioned Concurrency**: Reduce Lambda cold starts
- **API Gateway Caching**: Cache responses with appropriate TTL
- **CDN Integration**: CloudFront for static assets
- **Multi-Region Deployment**: Global availability and disaster recovery
- **Database Layer**: Add RDS/DynamoDB for application data
- **Connection Pooling**: Optimize database connections

## 🐛 Troubleshooting

### Common Issues

#### Local Development
```bash
# Docker issues
docker-compose down -v
docker system prune
make dev

# Port conflicts
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

#### AWS Deployment
```bash
# CDK bootstrap issues
cdk bootstrap --context stage=dev

# Permission errors
aws sts get-caller-identity
aws configure list
```

#### Authentication Issues
```bash
# Check Cognito configuration
aws cognito-idp describe-user-pool --user-pool-id <pool-id>

# Verify Google OAuth settings
# Check redirect URIs in Google Cloud Console
```

## 🎓 Learning Outcomes

This PoC demonstrates key concepts for building hybrid authentication systems:

### Technical Learnings
- **Custom Lambda Authorizer**: How to validate multiple token types in one authorizer
- **Token Strategy**: Handling OAuth providers that don't integrate natively with Cognito
- **Environment Consistency**: Making auth work both locally and in AWS
- **CDK Infrastructure**: Deploying authentication infrastructure as code

### Architecture Patterns
- **Unified User Experience**: Single auth flow for multiple providers
- **Token Abstraction**: Consistent user context regardless of auth method
- **Development Workflow**: Local development with production parity

## 📚 Additional Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Lambda Authorizers Guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-lambda-authorizer-lambda-function-create.html)
- [Fastify Documentation](https://www.fastify.io/docs/)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)

## 🤝 Contributing

This is a PoC project. Feel free to:
1. Fork and experiment with different auth patterns
2. Submit issues for bugs or improvements  
3. Share your own authentication integration experiences
4. Extend the PoC with additional OAuth providers

## 🆘 Support & Troubleshooting

**For PoC-related questions:**
- Check the troubleshooting section above
- Review CloudWatch logs for deployment issues
- Create an issue with your specific setup details

**Remember**: This is a proof-of-concept. For production use, implement additional security, monitoring, and error handling as outlined in the limitations sections.

---

**⭐ Star this repo if it helped you understand AWS Cognito + OAuth integration patterns!**
