import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface AuthPocStackProps extends cdk.StackProps {
  stage: string;
  googleClientId: string;
  googleClientSecret: string;
}

export class AuthPocStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly api: apigateway.RestApi;
  public readonly authorizerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: AuthPocStackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'AuthUserPool', {
      userPoolName: `auth-poc-${props.stage}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add Google Identity Provider
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: props.googleClientId,
      clientSecret: props.googleClientSecret,
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
      },
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'AuthUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `auth-client-${props.stage}`,
      generateSecret: true,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,
        custom: true, // Enable custom auth flows for federated users
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3001/api/auth/callback',
          `https://auth-${props.stage}.demo.krishnal.com/api/auth/callback`,
        ],
        logoutUrls: [
          'http://localhost:3000/',
          `https://auth-${props.stage}.demo.krishnal.com/`,
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    this.userPoolClient.node.addDependency(googleProvider);

    // Create Cognito Domain for OAuth2 endpoints
    const cognitoDomain = new cognito.UserPoolDomain(this, 'CognitoDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `auth-poc-${props.stage}`,
      },
    });

    // Create Lambda Authorizer Function
    this.authorizerFunction = new nodejs.NodejsFunction(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X, // Note: NODEJS_20_X not yet available in this CDK version
      handler: 'handler',
      entry: path.resolve(__dirname, '../../../backend/src/handlers/authorizer.ts'),
      projectRoot: path.resolve(__dirname, '../../..'),
      functionName: `auth-authorizer-${props.stage}`,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        STAGE: props.stage,
        GOOGLE_CLIENT_ID: props.googleClientId,
      },
      bundling: {
        externalModules: ['aws-sdk', '@aws-sdk/*', 'aws-jwt-verify', 'google-auth-library'],
        minify: true,
        esbuildArgs: {
          '--platform': 'node',
          '--target': 'node18',
          '--format': 'cjs',
        },
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to the authorizer function
    this.authorizerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:GetUser',
        'cognito-idp:AdminGetUser',
        'cognito-identity:GetId',
        'cognito-identity:GetCredentialsForIdentity',
      ],
      resources: [this.userPool.userPoolArn],
    }));

    // Create Backend Lambda Function
    const backendFunction = new nodejs.NodejsFunction(this, 'BackendFunction', {
      runtime: lambda.Runtime.NODEJS_18_X, // Note: NODEJS_20_X not yet available in this CDK version
      handler: 'handler',
      entry: path.resolve(__dirname, '../../../backend/src/handlers/api.ts'),
      projectRoot: path.resolve(__dirname, '../../..'),
      functionName: `auth-backend-${props.stage}`,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        // COGNITO_CLIENT_SECRET is retrieved at runtime from the User Pool Client
        COGNITO_DOMAIN: cognitoDomain.domainName,
        STAGE: props.stage,
        GOOGLE_CLIENT_ID: props.googleClientId,
        GOOGLE_CLIENT_SECRET: props.googleClientSecret,
      },
      bundling: {
        externalModules: ['aws-sdk', '@aws-sdk/*', '@aws-sdk/client-cognito-identity-provider', 'google-auth-library', 'aws-jwt-verify', '@fastify/aws-lambda', '@fastify/cors', 'fastify'],
        minify: true,
        esbuildArgs: {
          '--platform': 'node',
          '--target': 'node18',
          '--format': 'cjs',
        },
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to the backend function
    backendFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:*',
      ],
      resources: [this.userPool.userPoolArn],
    }));

    // Grant permissions to describe User Pool Client (needed to get client secret)
    backendFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:DescribeUserPoolClient',
      ],
      resources: [this.userPool.userPoolArn],
    }));

    // Create API Gateway with Lambda Authorizer
    const authorizer = new apigateway.TokenAuthorizer(this, 'LambdaAuthorizer', {
      handler: this.authorizerFunction,
      resultsCacheTtl: cdk.Duration.minutes(5),
      identitySource: 'method.request.header.Authorization',
      authorizerName: `auth-authorizer-${props.stage}`,
    });

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'AuthAPI', {
      restApiName: `auth-api-${props.stage}`,
      description: 'Authentication System API',
      defaultCorsPreflightOptions: {
        allowOrigins: [
          'http://localhost:3000',
          `https://auth-${props.stage}.demo.krishnal.com`,
        ],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: props.stage,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // Add public endpoints (no auth required)
    const authResource = this.api.root.addResource('auth');
    
    // Login endpoint
    authResource.addResource('login').addMethod('POST', 
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );

    // Google OAuth endpoints
    const googleResource = authResource.addResource('google');
    // Keep the old POST endpoint for backward compatibility during migration
    googleResource.addMethod('POST', 
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );
    // Add new GET endpoint for OAuth redirect
    googleResource.addMethod('GET', 
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );

    // OAuth callback endpoint
    const callbackResource = authResource.addResource('callback');
    callbackResource.addMethod('GET', 
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );

    // Signup endpoint
    authResource.addResource('signup').addMethod('POST',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );

    // Password reset endpoints
    const passwordResource = authResource.addResource('password');
    passwordResource.addResource('forgot').addMethod('POST',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );
    passwordResource.addResource('reset').addMethod('POST',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );

    // Refresh token endpoint
    authResource.addResource('refresh').addMethod('POST',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );

    // Debug endpoints (no auth required)
    const debugResource = this.api.root.addResource('debug');
    debugResource.addResource('headers').addMethod('GET',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      })
    );

    // Add protected endpoints (auth required)
    const apiResource = this.api.root.addResource('api');
    
    // User profile endpoints
    const userResource = apiResource.addResource('user');
    userResource.addMethod('GET',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      }),
      {
        authorizer,
      }
    );
    
    userResource.addMethod('PUT',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      }),
      {
        authorizer,
      }
    );

    // Protected data endpoint
    const dataResource = apiResource.addResource('data');
    dataResource.addMethod('GET',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      }),
      {
        authorizer,
      }
    );

    // Auth test endpoint for debugging
    const authTestResource = apiResource.addResource('auth-test');
    authTestResource.addMethod('GET',
      new apigateway.LambdaIntegration(backendFunction, {
        proxy: true,
      }),
      {
        authorizer,
      }
    );

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: cognitoDomain.domainName,
      description: 'Cognito Domain for OAuth2 endpoints',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });
  }
}
