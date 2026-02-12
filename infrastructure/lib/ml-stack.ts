import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface MlStackProps extends cdk.StackProps {}

/**
 * Placeholder stack for ML-related resources:
 * - S3 buckets for training data
 * - (Optional) SageMaker / batch jobs
 */
export class MlStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MlStackProps = {}) {
    super(scope, id, props);

    // TODO: Add ML-related infra once pipeline is defined.
  }
}

