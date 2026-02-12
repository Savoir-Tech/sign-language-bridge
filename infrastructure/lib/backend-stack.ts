import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface BackendStackProps extends cdk.StackProps {}

/**
 * Placeholder stack for:
 * - API Gateway (REST/WebSocket)
 * - Lambda functions
 * - DynamoDB tables
 */
export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BackendStackProps = {}) {
    super(scope, id, props);

    // TODO: Define API Gateway WebSocket API + Lambdas + DynamoDB.
  }
}

