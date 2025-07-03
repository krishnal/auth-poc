#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AuthPocStack } from '../lib/auth-poc-stack';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const googleClientId = app.node.tryGetContext('googleClientId') || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = app.node.tryGetContext('googleClientSecret') || process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  throw new Error('Google OAuth credentials are required');
}

new AuthPocStack(app, `AuthPocStack-${stage}`, {
  stage,
  googleClientId,
  googleClientSecret,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  },
});