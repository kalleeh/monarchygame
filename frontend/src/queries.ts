/* tslint:disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getKingdom = /* GraphQL */ `query GetKingdom($id: ID!) {
  getKingdom(id: $id) {
    ageStartTime
    buildings
    createdAt
    currentAge
    id
    isActive
    isOnline
    lastActive
    name
    owner
    race
    resources
    stats
    totalUnits
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetKingdomQueryVariables,
  APITypes.GetKingdomQuery
>;
export const getTerritory = /* GraphQL */ `query GetTerritory($id: ID!) {
  getTerritory(id: $id) {
    buildings
    coordinates
    createdAt
    defenseLevel
    id
    kingdomId
    name
    owner
    resources
    terrainType
    type
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetTerritoryQueryVariables,
  APITypes.GetTerritoryQuery
>;
export const listKingdoms = /* GraphQL */ `query ListKingdoms(
  $filter: ModelKingdomFilterInput
  $limit: Int
  $nextToken: String
) {
  listKingdoms(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      ageStartTime
      buildings
      createdAt
      currentAge
      id
      isActive
      isOnline
      lastActive
      name
      owner
      race
      resources
      stats
      totalUnits
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListKingdomsQueryVariables,
  APITypes.ListKingdomsQuery
>;
export const listTerritories = /* GraphQL */ `query ListTerritories(
  $filter: ModelTerritoryFilterInput
  $limit: Int
  $nextToken: String
) {
  listTerritories(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      buildings
      coordinates
      createdAt
      defenseLevel
      id
      kingdomId
      name
      owner
      resources
      terrainType
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListTerritoriesQueryVariables,
  APITypes.ListTerritoriesQuery
>;
