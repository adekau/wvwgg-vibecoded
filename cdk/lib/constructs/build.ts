import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { execSync } from "node:child_process";
import path from "node:path";

export interface NextJsBuildProps {
    buildCommand: string;
    contextPaths: Record<string, string>;
}

export class WvWGGBuild extends Construct {
    public buildImageDigest: string;
    public props: NextJsBuildProps;
    public nextJsImage: cdk.aws_lambda.DockerImageCode;

    constructor(scope: Construct, id: string, props: NextJsBuildProps) {
        super(scope, id);
        this.props = props;

        const builderImageTag = `wvwgg/builder-${this.node.addr.slice(0, 30)}`;
        this.createBuildImage(builderImageTag);
        // Get the digest (SHA) of the built image
        this.buildImageDigest = this.getDockerImageDigest(builderImageTag);
        this.nextJsImage = this.createNextJsImage(builderImageTag);
    }

    private createBuildImage(builderImageTag: string) {
        const buildArgs = {
            BUILD_COMMAND: this.props.buildCommand ?? 'npm run build'
        };
        const buildArgsString = this.getBuildArgsString(buildArgs);
        const contextPathsString = this.getContextPathsString(this.props.contextPaths);
        const dockerfilePath = path.join(__dirname, 'builder.Dockerfile');
        const command = `docker build -t ${builderImageTag} -f ${dockerfilePath} ${buildArgsString} ${contextPathsString} .`;

        // Create the docker image
        try {
            execSync(command, {
                stdio: "inherit",
                cwd: __dirname,
                env: process.env,
            });
        } catch (error) {
            console.error('Error building Docker image', error);
            throw error;
        }
    }

    private createNextJsImage(builderImageTag: string) {
        const dockerfileName = 'nextjs.Dockerfile';
        const dockerImageCode = cdk.aws_lambda.DockerImageCode.fromImageAsset(__dirname, {
            file: dockerfileName,
            buildArgs: {
                BUILDER_IMAGE_TAG: builderImageTag
            },
            cmd: ['node', 'server.js'],
            exclude: ['*', `!${dockerfileName}`],
            extraHash: this.buildImageDigest,
            ignoreMode: cdk.IgnoreMode.DOCKER
        });

        return dockerImageCode;
    }

    // Convert the build args to a string of docker build arguments
    private getBuildArgsString(buildArgs: Record<string, string>) {
        return Object.entries(buildArgs)
            .map(([key, value]) => `--build-arg '${key}=${value}'`)
            .join(' ');
    }

    private getContextPathsString(contextPaths: Record<string, string>) {
        return Object.entries(contextPaths)
            .map(([key, value]) => `--build-context ${key}=${value}`)
            .join(' ');
    }

    // Get the digest (SHA) of the built image
    private getDockerImageDigest(imageTag: string) {
        const command = `docker images --no-trunc --quiet ${imageTag}`;
        const digest = execSync(command, {
            encoding: 'utf-8'
        });
        return digest.toString().trim();
    }
} 