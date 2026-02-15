/* tslint:disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateKingdom = /* GraphQL */ `subscription OnCreateKingdom(
  $filter: ModelSubscriptionKingdomFilterInput
  $owner: String
) {
  onCreateKingdom(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateKingdomSubscriptionVariables,
  APITypes.OnCreateKingdomSubscription
>;
export const onCreateTerritory = /* GraphQL */ `subscription OnCreateTerritory(
  $filter: ModelSubscriptionTerritoryFilterInput
  $owner: String
) {
  onCreateTerritory(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateTerritorySubscriptionVariables,
  APITypes.OnCreateTerritorySubscription
>;
export const onDeleteKingdom = /* GraphQL */ `subscription OnDeleteKingdom(
  $filter: ModelSubscriptionKingdomFilterInput
  $owner: String
) {
  onDeleteKingdom(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteKingdomSubscriptionVariables,
  APITypes.OnDeleteKingdomSubscription
>;
export const onDeleteTerritory = /* GraphQL */ `subscription OnDeleteTerritory(
  $filter: ModelSubscriptionTerritoryFilterInput
  $owner: String
) {
  onDeleteTerritory(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteTerritorySubscriptionVariables,
  APITypes.OnDeleteTerritorySubscription
>;
export const onUpdateKingdom = /* GraphQL */ `subscription OnUpdateKingdom(
  $filter: ModelSubscriptionKingdomFilterInput
  $owner: String
) {
  onUpdateKingdom(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateKingdomSubscriptionVariables,
  APITypes.OnUpdateKingdomSubscription
>;
export const onUpdateTerritory = /* GraphQL */ `subscription OnUpdateTerritory(
  $filter: ModelSubscriptionTerritoryFilterInput
  $owner: String
) {
  onUpdateTerritory(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateTerritorySubscriptionVariables,
  APITypes.OnUpdateTerritorySubscription
>;
