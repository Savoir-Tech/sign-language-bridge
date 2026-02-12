#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FrontendStack } from "../lib/frontend-stack";
import { BackendStack } from "../lib/backend-stack";
import { MlStack } from "../lib/ml-stack";

const app = new cdk.App();

// NOTE: These stacks are placeholders; fill in resources as you design infra.
new FrontendStack(app, "SignLanguageBridge-Frontend", {});
new BackendStack(app, "SignLanguageBridge-Backend", {});
new MlStack(app, "SignLanguageBridge-ML", {});

