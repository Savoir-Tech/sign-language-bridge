import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface FrontendStackProps extends cdk.StackProps {}

/**
 * Placeholder stack for hosting the React frontend
 * (e.g., S3 + CloudFront or Amplify).
 */
export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps = {}) {
    super(scope, id, props);

    // TODO: Add S3 bucket, CloudFront distribution, etc.
  }
}

