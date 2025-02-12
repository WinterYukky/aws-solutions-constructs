/**
 *  Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

// Imports
import { Bucket, BucketProps, BucketEncryption } from "@aws-cdk/aws-s3";
import { Construct, RemovalPolicy, Stack } from "@aws-cdk/core";
import { buildVpc } from '../lib/vpc-helper';
import { DefaultPublicPrivateVpcProps, DefaultIsolatedVpcProps } from '../lib/vpc-defaults';
import { overrideProps, addCfnSuppressRules } from "../lib/utils";
import { createCacheSubnetGroup  } from "../lib/elasticache-helper";
import * as path from 'path';
import * as cache from '@aws-cdk/aws-elasticache';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as acm from '@aws-cdk/aws-certificatemanager';
import { CfnFunction } from "@aws-cdk/aws-lambda";
import { GetDefaultCachePort } from "../lib/elasticache-defaults";

export const fakeEcrRepoArn = 'arn:aws:ecr:us-east-1:123456789012:repository/fake-repo';

// Creates a bucket used for testing - minimal properties, destroyed after test
export function CreateScrapBucket(scope: Construct, props?: BucketProps | any) {
  const defaultProps = {
    versioned: true,
    removalPolicy: RemovalPolicy.DESTROY,
    encryption: BucketEncryption.S3_MANAGED,
  };

  let synthesizedProps: BucketProps;
  if (props) {
    synthesizedProps = overrideProps(defaultProps, props);
  } else {
    synthesizedProps = defaultProps;
  }

  const scriptBucket = new Bucket(
    scope,
    "existingScriptLocation",
    synthesizedProps
  );

  addCfnSuppressRules(scriptBucket, [
    {
      id: "W51",
      reason: "This S3 bucket is created for unit/ integration testing purposes only and not part of       the actual construct implementation",
    },
    {
      id: "W35",
      reason: "This S3 bucket is created for unit/ integration testing purposes only and not part of       the actual construct implementation",
    },
    {
      id: "W41",
      reason: "This S3 bucket is created for unit/ integration testing purposes only and not part of       the actual construct",
    }
  ]);

  return scriptBucket;
}

/**
 * @summary Creates a stack name for Integration tests
 * @param {string} filename - the filename of the integ test
 * @returns {string} - a string with current filename after removing anything before the prefix '.' and suffix '.js'
 * e.g. 'integ.apigateway-dynamodb-CRUD.js' will return 'apigateway-dynamodb-CRUD'
 */
export function generateIntegStackName(filename: string): string {
  const file = path.basename(filename, path.extname(filename));
  const stackname = file.slice(file.lastIndexOf('.') + 1).replace(/_/g, '-');
  return stackname;
}

// Helper Functions
export function getTestVpc(stack: Stack, publicFacing: boolean = true, userVpcProps?: ec2.VpcProps) {
  return buildVpc(stack, {
    defaultVpcProps: publicFacing ?
      DefaultPublicPrivateVpcProps() :
      DefaultIsolatedVpcProps(),
    constructVpcProps: {
      enableDnsHostnames: true,
      enableDnsSupport: true,
      cidr: '172.168.0.0/16',
    },
    userVpcProps
  });
}

export function getFakeCertificate(scope: Construct, id: string): acm.ICertificate {
  return acm.Certificate.fromCertificateArn(
    scope,
    id,
    "arn:aws:acm:us-east-1:123456789012:certificate/11112222-3333-1234-1234-123456789012"
  );
}

export function suppressAutoDeleteHandlerWarnings(stack: Stack) {
  Stack.of(stack).node.children.forEach(child => {
    if (child.node.id === 'Custom::S3AutoDeleteObjectsCustomResourceProvider') {
      const handlerFunction = child.node.findChild('Handler') as CfnFunction;
      addCfnSuppressRules(handlerFunction, [{ id: "W58", reason: "CDK generated custom resource"}]);
      addCfnSuppressRules(handlerFunction, [{ id: "W89", reason: "CDK generated custom resource"}]);
      addCfnSuppressRules(handlerFunction, [{ id: "W92", reason: "CDK generated custom resource"}]);
    }
  });

}

export function CreateTestCache(scope: Construct, id: string, vpc: ec2.IVpc, port?: number) {
  const cachePort = port ?? GetDefaultCachePort();

  // Create the subnet group from all the isolated subnets in the VPC
  const subnetGroup = createCacheSubnetGroup(scope, vpc, id);
  const emptySG = new ec2.SecurityGroup(scope, `${id}-cachesg`, {
    vpc,
    allowAllOutbound: true,
  });
  addCfnSuppressRules(emptySG, [{ id: "W40", reason: "Test Resource" }]);
  addCfnSuppressRules(emptySG, [{ id: "W5", reason: "Test Resource" }]);
  addCfnSuppressRules(emptySG, [{ id: "W36", reason: "Test Resource" }]);

  const cacheProps = {
    clusterName: `${id}-cdk-cluster`,
    cacheNodeType: "cache.t3.medium",
    engine: "memcached",
    numCacheNodes: 2,
    port: cachePort,
    azMode: "cross-az",
    vpcSecurityGroupIds: [emptySG.securityGroupId],
    cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
  };

  const newCache = new cache.CfnCacheCluster(
    scope,
    `${id}-cluster`,
    cacheProps
  );
  newCache.addDependsOn(subnetGroup);
  return newCache;
}
