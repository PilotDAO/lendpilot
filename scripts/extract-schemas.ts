#!/usr/bin/env tsx
/**
 * Extract GraphQL schemas from AaveKit and Aave Subgraph
 */

import { GraphQLClient } from "graphql-request";
import { writeFileSync } from "fs";
import { join } from "path";
import { env } from "@/lib/config/env";

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function extractAaveKitSchema() {
  console.log("📥 Extracting AaveKit GraphQL schema...");
  
  const client = new GraphQLClient(env.AAVEKIT_GRAPHQL_URL);
  
  try {
    const schema = await client.request(introspectionQuery);
    const schemaPath = join(process.cwd(), "schema", "aavekit_schema.json");
    writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
    console.log(`✓ Saved AaveKit schema to ${schemaPath}`);
  } catch (error) {
    console.error("❌ Failed to extract AaveKit schema:", error);
    throw error;
  }
}

async function extractSubgraphSchema() {
  console.log("📥 Extracting Aave Subgraph schema...");
  
  const subgraphUrl = `https://gateway.thegraph.com/api/${env.GRAPH_API_KEY}/subgraphs/id/${env.AAVE_SUBGRAPH_ID}`;
  const client = new GraphQLClient(subgraphUrl);
  
  try {
    const schema = await client.request(introspectionQuery);
    const schemaPath = join(process.cwd(), "schema", "aave_subgraph_schema.json");
    writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
    console.log(`✓ Saved Aave Subgraph schema to ${schemaPath}`);
  } catch (error) {
    console.error("❌ Failed to extract Subgraph schema:", error);
    throw error;
  }
}

async function main() {
  try {
    await extractAaveKitSchema();
    await extractSubgraphSchema();
    console.log("\n✅ Schema extraction completed!");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
