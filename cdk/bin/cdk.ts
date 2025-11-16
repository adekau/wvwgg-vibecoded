#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WvWGGStack } from '../lib/wvwgg-stack-simplified';
import { AutomationStack } from '../lib/automation-stack';

const app = new cdk.App();

// Automation stack for guild syncing (Step Functions + Lambda)
const automationStack = new AutomationStack(app, 'WvWGG-Automation', {
  env: {
    region: 'us-east-1'
  }
});

// Development environment
if (process.env.WVWGG_STAGE === 'dev') {
  new WvWGGStack(app, 'WvWGG-Dev-DataLayer', {
    stage: 'dev',
    automationStack,
    env: {
      region: 'us-east-1'
    }
  });
  // Removed explicit dependency - CDK will infer it from resource references
}

// Production environment
if (process.env.WVWGG_STAGE === 'prod') {
  new WvWGGStack(app, 'WvWGG-Prod-DataLayer', {
    stage: 'prod',
    automationStack,
    env: {
      region: 'us-east-1'
    }
  });
  // Removed explicit dependency - CDK will infer it from resource references
}
