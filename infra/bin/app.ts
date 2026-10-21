import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { App, Tags } from 'aws-cdk-lib';
import { SiteStack } from '../lib/site-stack.ts';

const siteDir = fileURLToPath(new URL('../../dist', import.meta.url));
if (!existsSync(`${siteDir}/index.html`)) {
  throw new Error(`No built site at ${siteDir}. Run "npm run build" in the project root first.`);
}

const app = new App();
const stack = new SiteStack(app, 'RuleExtractionSite', {
  siteDir,
  domainName: 'rulebook.moving-parts.dev',
  zoneName: 'moving-parts.dev',
  // Account and region come from the active AWS CLI profile. The region must be
  // us-east-1: CloudFront only accepts certificates from there.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  description: 'From Black Box to Rulebook: static site on S3 + CloudFront',
});
Tags.of(stack).add('project', 'black-box-to-rulebook');
