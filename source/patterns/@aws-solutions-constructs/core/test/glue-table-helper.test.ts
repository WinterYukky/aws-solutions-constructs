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

import { ResourcePart } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import { Aws, Stack } from '@aws-cdk/core';
import * as defaults from '..';

const _fieldSchema = [{
  name: "id",
  type: "int",
  comment: "Identifier for the record"
}, {
  name: "name",
  type: "string",
  comment: "The name of the record"
}, {
  name: "type",
  type: "string",
  comment: "The type of the record"
}, {
  name: "numericvalue",
  type: "int",
  comment: "Some value associated with the record"
}];

// --------------------------------------------------------------
// Create database by passing props
// --------------------------------------------------------------
test('create default CfnTable with default props', () => {
  const stack = new Stack();
  defaults.DefaultGlueTable(stack, {
    catalogId: 'fakecatalogfortest',
    databaseName: 'fakedatabase',
    tableInput: {
      parameters: {
        classification: 'json'
      },
      storageDescriptor: {
        parameters: {
          endpointUrl: `https://kinesis.${Aws.REGION}.amazonaws.com`,
          streamName: 'testStream',
          typeOfData: 'kinesis'
        }
      }
    }
  });

  expect(stack).toHaveResourceLike('AWS::Glue::Table', {
    Type: "AWS::Glue::Table",
    Properties: {
      CatalogId: "fakecatalogfortest",
      DatabaseName: "fakedatabase",
      TableInput: {
        Parameters: {
          classification: "json"
        },
        StorageDescriptor: {
          Parameters: {
            endpointUrl: {
              "Fn::Join": [
                "",
                [
                  "https://kinesis.",
                  {
                    Ref: "AWS::Region"
                  },
                  ".amazonaws.com"
                ]
              ]
            },
            streamName: "testStream",
            typeOfData: "kinesis"
          }
        }
      }
    }
  }, ResourcePart.CompleteDefinition);
});

// --------------------------------------------------------------
// Create database by passing no props to database (default database)
// --------------------------------------------------------------
test('Create table', () => {
  const stack = new Stack();
  defaults.createGlueTable(stack, defaults.createGlueDatabase(stack), undefined, _fieldSchema, 'kinesis', {
    STREAM_NAME: 'testStream'
  });
  expect(stack).toHaveResourceLike('AWS::Glue::Database', {
    Type: "AWS::Glue::Database",
    Properties: {
      CatalogId: {
        Ref: "AWS::AccountId"
      },
      DatabaseInput: {
        Description: "An AWS Glue database generated by AWS Solutions Construct"
      }
    }
  }, ResourcePart.CompleteDefinition);

  expect(stack).toHaveResourceLike('AWS::Glue::Table', {
    Properties: {
      CatalogId: {
        Ref: "AWS::AccountId"
      },
      DatabaseName: {
        Ref: "GlueDatabase"
      },
      TableInput: {
        Parameters: {
          classification: "json"
        },
        StorageDescriptor: {
          Columns: [
            {
              Comment: "Identifier for the record",
              Name: "id",
              Type: "int"
            },
            {
              Comment: "The name of the record",
              Name: "name",
              Type: "string"
            },
            {
              Comment: "The type of the record",
              Name: "type",
              Type: "string"
            },
            {
              Comment: "Some value associated with the record",
              Name: "numericvalue",
              Type: "int"
            }
          ],
          Compressed: false,
          InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          Location: "testStream",
          NumberOfBuckets: -1,
          OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          Parameters: {
            endpointUrl: {
              "Fn::Join": [
                "",
                [
                  "https://kinesis.",
                  {
                    Ref: "AWS::Region"
                  },
                  ".amazonaws.com"
                ]
              ]
            },
            streamName: "testStream",
            typeOfData: "kinesis"
          },
          SerdeInfo: {
            Parameters: {
              paths: "id,name,type,numericvalue"
            },
            SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
          }
        },
        TableType: "EXTERNAL_TABLE"
      }
    }
  }, ResourcePart.CompleteDefinition);
});

// --------------------------------------------------------------
// Pass an unsupported source type, it should throw an error
// --------------------------------------------------------------
test('error condition', () => {
  const stack = new Stack();
  try {
    const _database = defaults.DefaultGlueDatabase(stack, defaults.DefaultGlueDatabaseProps());
    defaults.DefaultGlueTable(_database, defaults.DefaultGlueTableProps(_database, _fieldSchema, 'SomeSource', {STREAM_NAME: 'somefakestream'}));
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
  }
});