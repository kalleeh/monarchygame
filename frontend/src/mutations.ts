/* tslint:disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createKingdom = /* GraphQL */ `mutation CreateKingdom(
  $condition: ModelKingdomConditionInput
  $input: CreateKingdomInput!
) {
  createKingdom(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateKingdomMutationVariables,
  APITypes.CreateKingdomMutation
>;
export const createTerritory = /* GraphQL */ `mutation CreateTerritory(
  $condition: ModelTerritoryConditionInput
  $input: CreateTerritoryInput!
) {
  createTerritory(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateTerritoryMutationVariables,
  APITypes.CreateTerritoryMutation
>;
export const deleteKingdom = /* GraphQL */ `mutation DeleteKingdom(
  $condition: ModelKingdomConditionInput
  $input: DeleteKingdomInput!
) {
  deleteKingdom(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteKingdomMutationVariables,
  APITypes.DeleteKingdomMutation
>;
export const deleteTerritory = /* GraphQL */ `mutation DeleteTerritory(
  $condition: ModelTerritoryConditionInput
  $input: DeleteTerritoryInput!
) {
  deleteTerritory(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteTerritoryMutationVariables,
  APITypes.DeleteTerritoryMutation
>;
export const updateKingdom = /* GraphQL */ `mutation UpdateKingdom(
  $condition: ModelKingdomConditionInput
  $input: UpdateKingdomInput!
) {
  updateKingdom(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateKingdomMutationVariables,
  APITypes.UpdateKingdomMutation
>;
export const updateTerritory = /* GraphQL */ `mutation UpdateTerritory(
  $condition: ModelTerritoryConditionInput
  $input: UpdateTerritoryInput!
) {
  updateTerritory(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateTerritoryMutationVariables,
  APITypes.UpdateTerritoryMutation
>;
