import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

export interface SiteStackProps extends StackProps {
  /** Absolute path to the built app (the Vite `dist/` folder). */
  siteDir: string;
  /** The address the site is served on, e.g. rulebook.moving-parts.dev. */
  domainName: string;
  /** The Route 53 hosted zone that domain belongs to (owned by the Moving Parts project). */
  zoneName: string;
}

/**
 * Static hosting: a private S3 bucket that only CloudFront can read
 * (Origin Access Control), served over HTTPS from CloudFront's edge
 * on its own subdomain of the Moving Parts domain.
 */
export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // The site is rebuilt from source on every deploy, so nothing in the bucket needs keeping.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Found by name, so this project doesn't depend on the Moving Parts code. The answer is
    // cached in cdk.context.json, which should be committed.
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.zoneName });

    // CloudFront only takes certificates from us-east-1, which is where this stack lives.
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'From Black Box to Rulebook: interactive rule-extraction story',
      domainNames: [props.domainName],
      certificate,
      defaultRootObject: 'index.html',
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
      },
      // The app routes with #hashes, so any other path is a typo: show the app (it lands on
      // the start page) instead of S3's raw "AccessDenied" XML, but keep the 404 status.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: '/index.html',
        ttl: Duration.minutes(1),
      })),
    });

    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
    new route53.ARecord(this, 'AliasA', { zone, recordName: props.domainName, target });
    new route53.AaaaRecord(this, 'AliasAaaa', { zone, recordName: props.domainName, target });

    // Vite's hashed files never change once published, so browsers may cache them for a year.
    const assets = new s3deploy.BucketDeployment(this, 'DeployAssets', {
      sources: [s3deploy.Source.asset(props.siteDir)],
      destinationBucket: bucket,
      exclude: ['*'],
      include: ['assets/*'],
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
    });

    // Everything else (index.html, favicon) must be revalidated, so a deploy shows up immediately.
    const root = new s3deploy.BucketDeployment(this, 'DeployRoot', {
      sources: [s3deploy.Source.asset(props.siteDir)],
      destinationBucket: bucket,
      exclude: ['assets/*'],
      cacheControl: [s3deploy.CacheControl.fromString('no-cache')],
      distribution,
      distributionPaths: ['/*'],
    });
    // Upload the new assets before the index.html that references them.
    root.node.addDependency(assets);

    new CfnOutput(this, 'SiteUrl', { value: `https://${props.domainName}` });
    new CfnOutput(this, 'CloudFrontUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
