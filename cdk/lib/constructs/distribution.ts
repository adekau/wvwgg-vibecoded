import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from "constructs";
import lambda = cdk.aws_lambda
import cloudfront = cdk.aws_cloudfront;
import origins = cdk.aws_cloudfront_origins;
import route53 = cdk.aws_route53;
import route53Targets = cdk.aws_route53_targets;

export interface NextJsDistributionProps {
    nextJsLambda: lambda.DockerImageFunction;
    nextJsAssetsBucket: s3.Bucket;
    domainNames: string[];
    zone: route53.HostedZone;
    certificate: acm.Certificate;
    stage: 'dev' | 'prod';
}

export class WvWGGDistribution extends Construct {
    public functionUrl: lambda.FunctionUrl;
    public distribution: cloudfront.Distribution;

    private commonSecurityHeadersBehavior: cloudfront.ResponseSecurityHeadersBehavior = {
        contentTypeOptions: { override: false },
        frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN,
            override: false,
        },
        referrerPolicy: {
            override: false,
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
        },
        strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            override: false,
            preload: true,
        },
        xssProtection: { override: false, protection: true, modeBlock: true },
    };

    constructor(scope: Construct, id: string, props: NextJsDistributionProps) {
        super(scope, id);
        this.functionUrl = props.nextJsLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.AWS_IAM,
            invokeMode: lambda.InvokeMode.RESPONSE_STREAM
        });
        
        // NextJS requires the x-forwarded-host header to match the host header for server actions to work.
        // Since this is forwarded by CloudFront, the headers will differ.
        // This function fixes the headers to make sure NextJS works.
        const xForwardedHostFix = new cloudfront.Function(this, 'WvWGGXForwardedHostFix', {
            code: cloudfront.FunctionCode.fromInline(`
                function handler(event) {
                    var request = event.request;
                    request.headers['x-forwarded-host'] = request.headers['host'];
                    return request;
                }
            `)
        });

        const origin = origins.FunctionUrlOrigin.withOriginAccessControl(this.functionUrl);
        const assetsOrigin = origins.S3BucketOrigin.withOriginAccessControl(props.nextJsAssetsBucket);

        this.distribution = new cloudfront.Distribution(this, `WvWGGNextJsCloudFront-${props.stage}`, {
            defaultBehavior: {
                origin,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                cachePolicy: this.createCachePolicy(),
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                responseHeadersPolicy: this.createResponseHeadersPolicy(props.stage),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                functionAssociations: [
                    {
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function: xForwardedHostFix
                    }
                ]
            },
            additionalBehaviors: {
                '_next/static/*': {
                    origin: assetsOrigin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
                },
                'public/*': {
                    origin: assetsOrigin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
                }
            },
            domainNames: props.domainNames,
            certificate: props.certificate
        });

        // points to the IP address of the CloudFront distribution
        new route53.ARecord(this, `WvWGGCloudFrontARecord-${props.stage}`, {
            zone: props.zone,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
            recordName: props.domainNames[0]
        });
    }

    private createCachePolicy(): cdk.aws_cloudfront.CachePolicy {
        return new cdk.aws_cloudfront.CachePolicy(this, `WvWGGNextJsLambdaCachePolicy`, {
            queryStringBehavior: cdk.aws_cloudfront.CacheQueryStringBehavior.all(),
            headerBehavior: cdk.aws_cloudfront.CacheHeaderBehavior.allowList(
                "accept",
                "rsc",
                "next-router-prefetch",
                "next-router-state-tree",
                "next-url",
                "x-prerender-revalidate",
            ),
            cookieBehavior: cdk.aws_cloudfront.CacheCookieBehavior.all(),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
            comment: `Nextjs Dynamic Cache Policy for ${cdk.Stack.of(this).stackName}`,
            defaultTtl: cdk.Duration.minutes(1),
            maxTtl: cdk.Duration.minutes(1)
        });
    }

    private createResponseHeadersPolicy(stage: 'dev' | 'prod'): cloudfront.ResponseHeadersPolicy {
        return new cloudfront.ResponseHeadersPolicy(this, `WvWGGNextJsLambdaResponseHeadersPolicy-${stage}`, {
            securityHeadersBehavior: this.commonSecurityHeadersBehavior,
            comment: `Nextjs Lambda Response Headers Policy for ${cdk.Stack.of(this).stackName}`
        });
    }
}
