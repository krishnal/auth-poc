.PHONY: help install setup-local dev deploy test clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install all dependencies
	@echo "Installing dependencies..."
	cd infrastructure && npm install
	cd backend && npm install
	cd frontend && npm install

setup-local: ## Setup local development environment
	@echo "Setting up local environment..."
	@if [ ! -f .env ]; then \
		echo "Creating .env file from template..."; \
		cp .env.example .env; \
		echo "Please update .env with your AWS and Google OAuth credentials"; \
	fi
	cd infrastructure && npm run setup:env
	@echo "Local setup complete!"

check-env: ## Check environment configuration
	@echo "Checking environment configuration..."
	cd infrastructure && npm run check:env

dev: ## Start local development environment
	@echo "Starting development environment..."
	docker-compose up --build

dev-stop: ## Stop local development environment
	docker-compose down

dev-logs: ## Show development logs
	docker-compose logs -f

build: ## Build all services
	@echo "Building all services..."
	cd infrastructure && npm run build
	cd backend && npm run build
	cd frontend && npm run build

test: ## Run all tests
	@echo "Running tests..."
	cd backend && npm test
	cd frontend && npm test

lint: ## Lint all code
	@echo "Linting code..."
	cd backend && npm run lint
	cd frontend && npm run lint

lint-fix: ## Fix linting issues
	@echo "Fixing linting issues..."
	cd backend && npm run lint:fix
	cd frontend && npm run lint:fix

deploy-dev: ## Deploy to development environment
	@echo "Deploying to development..."
	cd infrastructure && npm run deploy -- --context stage=dev

deploy-prod: ## Deploy to production environment
	@echo "Deploying to production..."
	cd infrastructure && npm run deploy -- --context stage=prod

synth-dev: ## Synthesize CloudFormation for development
	@echo "Synthesizing development stack..."
	cd infrastructure && npm run synth -- --context stage=dev

synth-prod: ## Synthesize CloudFormation for production
	@echo "Synthesizing production stack..."
	cd infrastructure && npm run synth -- --context stage=prod

destroy-dev: ## Destroy development environment
	@echo "Destroying development environment..."
	cd infrastructure && npm run cdk -- destroy --context stage=dev

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf infrastructure/cdk.out
	rm -rf infrastructure/node_modules
	rm -rf backend/dist
	rm -rf backend/node_modules
	rm -rf frontend/build
	rm -rf frontend/node_modules

bootstrap: ## Bootstrap CDK (run once per AWS account/region)
	@echo "Bootstrapping CDK..."
	cd infrastructure && npx cdk bootstrap
