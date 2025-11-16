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
  const devDeployment = new WvWGGStack(app, 'WvWGG-Dev-DataLayer', {
    stage: 'dev',
    automationStack,
    env: {
      region: 'us-east-1'
    }
  });
  devDeployment.node.addDependency(automationStack);
}

// Production environment
if (process.env.WVWGG_STAGE === 'prod') {
  const prodDeployment = new WvWGGStack(app, 'WvWGG-Prod-DataLayer', {
    stage: 'prod',
    automationStack,
    env: {
      region: 'us-east-1'
    }
  });
  prodDeployment.node.addDependency(automationStack);
}
