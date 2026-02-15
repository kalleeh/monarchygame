/* tslint:disable */
//  This file was automatically generated and should not be edited.

export type Kingdom = {
  __typename: "Kingdom",
  ageStartTime?: string | null,
  buildings: string,
  createdAt?: string | null,
  currentAge?: KingdomCurrentAge | null,
  id: string,
  isActive?: boolean | null,
  isOnline?: boolean | null,
  lastActive?: string | null,
  name: string,
  owner?: string | null,
  race?: KingdomRace | null,
  resources: string,
  stats: string,
  totalUnits: string,
  updatedAt: string,
};

export enum KingdomCurrentAge {
  early = "early",
  late = "late",
  middle = "middle",
}


export enum KingdomRace {
  Centaur = "Centaur",
  Droben = "Droben",
  Dwarven = "Dwarven",
  Elemental = "Elemental",
  Elven = "Elven",
  Fae = "Fae",
  Goblin = "Goblin",
  Human = "Human",
  Sidhe = "Sidhe",
  Vampire = "Vampire",
}


export type Territory = {
  __typename: "Territory",
  buildings: string,
  coordinates: string,
  createdAt?: string | null,
  defenseLevel: number,
  id: string,
  kingdomId: string,
  name: string,
  owner?: string | null,
  resources: string,
  terrainType?: TerritoryTerrainType | null,
  type?: TerritoryType | null,
  updatedAt?: string | null,
};

export enum TerritoryTerrainType {
  coastal = "coastal",
  desert = "desert",
  forest = "forest",
  mountains = "mountains",
  plains = "plains",
  swamp = "swamp",
}


export enum TerritoryType {
  capital = "capital",
  fortress = "fortress",
  outpost = "outpost",
  settlement = "settlement",
}


export type ModelKingdomFilterInput = {
  ageStartTime?: ModelStringInput | null,
  and?: Array< ModelKingdomFilterInput | null > | null,
  buildings?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  currentAge?: ModelKingdomCurrentAgeInput | null,
  id?: ModelIDInput | null,
  isActive?: ModelBooleanInput | null,
  isOnline?: ModelBooleanInput | null,
  lastActive?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelKingdomFilterInput | null,
  or?: Array< ModelKingdomFilterInput | null > | null,
  owner?: ModelStringInput | null,
  race?: ModelKingdomRaceInput | null,
  resources?: ModelStringInput | null,
  stats?: ModelStringInput | null,
  totalUnits?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelStringInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  _null = "_null",
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
}


export type ModelSizeInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelKingdomCurrentAgeInput = {
  eq?: KingdomCurrentAge | null,
  ne?: KingdomCurrentAge | null,
};

export type ModelIDInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export type ModelBooleanInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  eq?: boolean | null,
  ne?: boolean | null,
};

export type ModelKingdomRaceInput = {
  eq?: KingdomRace | null,
  ne?: KingdomRace | null,
};

export type ModelKingdomConnection = {
  __typename: "ModelKingdomConnection",
  items:  Array<Kingdom | null >,
  nextToken?: string | null,
};

export type ModelTerritoryFilterInput = {
  and?: Array< ModelTerritoryFilterInput | null > | null,
  buildings?: ModelStringInput | null,
  coordinates?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  defenseLevel?: ModelIntInput | null,
  id?: ModelIDInput | null,
  kingdomId?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelTerritoryFilterInput | null,
  or?: Array< ModelTerritoryFilterInput | null > | null,
  owner?: ModelStringInput | null,
  resources?: ModelStringInput | null,
  terrainType?: ModelTerritoryTerrainTypeInput | null,
  type?: ModelTerritoryTypeInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelIntInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelTerritoryTerrainTypeInput = {
  eq?: TerritoryTerrainType | null,
  ne?: TerritoryTerrainType | null,
};

export type ModelTerritoryTypeInput = {
  eq?: TerritoryType | null,
  ne?: TerritoryType | null,
};

export type ModelTerritoryConnection = {
  __typename: "ModelTerritoryConnection",
  items:  Array<Territory | null >,
  nextToken?: string | null,
};

export type ModelKingdomConditionInput = {
  ageStartTime?: ModelStringInput | null,
  and?: Array< ModelKingdomConditionInput | null > | null,
  buildings?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  currentAge?: ModelKingdomCurrentAgeInput | null,
  isActive?: ModelBooleanInput | null,
  isOnline?: ModelBooleanInput | null,
  lastActive?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelKingdomConditionInput | null,
  or?: Array< ModelKingdomConditionInput | null > | null,
  owner?: ModelStringInput | null,
  race?: ModelKingdomRaceInput | null,
  resources?: ModelStringInput | null,
  stats?: ModelStringInput | null,
  totalUnits?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateKingdomInput = {
  ageStartTime?: string | null,
  buildings: string,
  createdAt?: string | null,
  currentAge?: KingdomCurrentAge | null,
  id?: string | null,
  isActive?: boolean | null,
  isOnline?: boolean | null,
  lastActive?: string | null,
  name: string,
  race?: KingdomRace | null,
  resources: string,
  stats: string,
  totalUnits: string,
};

export type ModelTerritoryConditionInput = {
  and?: Array< ModelTerritoryConditionInput | null > | null,
  buildings?: ModelStringInput | null,
  coordinates?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  defenseLevel?: ModelIntInput | null,
  kingdomId?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelTerritoryConditionInput | null,
  or?: Array< ModelTerritoryConditionInput | null > | null,
  owner?: ModelStringInput | null,
  resources?: ModelStringInput | null,
  terrainType?: ModelTerritoryTerrainTypeInput | null,
  type?: ModelTerritoryTypeInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateTerritoryInput = {
  buildings: string,
  coordinates: string,
  createdAt?: string | null,
  defenseLevel: number,
  id?: string | null,
  kingdomId: string,
  name: string,
  resources: string,
  terrainType?: TerritoryTerrainType | null,
  type?: TerritoryType | null,
  updatedAt?: string | null,
};

export type DeleteKingdomInput = {
  id: string,
};

export type DeleteTerritoryInput = {
  id: string,
};

export type UpdateKingdomInput = {
  ageStartTime?: string | null,
  buildings?: string | null,
  createdAt?: string | null,
  currentAge?: KingdomCurrentAge | null,
  id: string,
  isActive?: boolean | null,
  isOnline?: boolean | null,
  lastActive?: string | null,
  name?: string | null,
  race?: KingdomRace | null,
  resources?: string | null,
  stats?: string | null,
  totalUnits?: string | null,
};

export type UpdateTerritoryInput = {
  buildings?: string | null,
  coordinates?: string | null,
  createdAt?: string | null,
  defenseLevel?: number | null,
  id: string,
  kingdomId?: string | null,
  name?: string | null,
  resources?: string | null,
  terrainType?: TerritoryTerrainType | null,
  type?: TerritoryType | null,
  updatedAt?: string | null,
};

export type ModelSubscriptionKingdomFilterInput = {
  ageStartTime?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionKingdomFilterInput | null > | null,
  buildings?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  currentAge?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  isActive?: ModelSubscriptionBooleanInput | null,
  isOnline?: ModelSubscriptionBooleanInput | null,
  lastActive?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionKingdomFilterInput | null > | null,
  owner?: ModelStringInput | null,
  race?: ModelSubscriptionStringInput | null,
  resources?: ModelSubscriptionStringInput | null,
  stats?: ModelSubscriptionStringInput | null,
  totalUnits?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionStringInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionIDInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionBooleanInput = {
  eq?: boolean | null,
  ne?: boolean | null,
};

export type ModelSubscriptionTerritoryFilterInput = {
  and?: Array< ModelSubscriptionTerritoryFilterInput | null > | null,
  buildings?: ModelSubscriptionStringInput | null,
  coordinates?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  defenseLevel?: ModelSubscriptionIntInput | null,
  id?: ModelSubscriptionIDInput | null,
  kingdomId?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionTerritoryFilterInput | null > | null,
  owner?: ModelStringInput | null,
  resources?: ModelSubscriptionStringInput | null,
  terrainType?: ModelSubscriptionStringInput | null,
  type?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionIntInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  in?: Array< number | null > | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
  notIn?: Array< number | null > | null,
};

export type GetKingdomQueryVariables = {
  id: string,
};

export type GetKingdomQuery = {
  getKingdom?:  {
    __typename: "Kingdom",
    ageStartTime?: string | null,
    buildings: string,
    createdAt?: string | null,
    currentAge?: KingdomCurrentAge | null,
    id: string,
    isActive?: boolean | null,
    isOnline?: boolean | null,
    lastActive?: string | null,
    name: string,
    owner?: string | null,
    race?: KingdomRace | null,
    resources: string,
    stats: string,
    totalUnits: string,
    updatedAt: string,
  } | null,
};

export type GetTerritoryQueryVariables = {
  id: string,
};

export type GetTerritoryQuery = {
  getTerritory?:  {
    __typename: "Territory",
    buildings: string,
    coordinates: string,
    createdAt?: string | null,
    defenseLevel: number,
    id: string,
    kingdomId: string,
    name: string,
    owner?: string | null,
    resources: string,
    terrainType?: TerritoryTerrainType | null,
    type?: TerritoryType | null,
    updatedAt?: string | null,
  } | null,
};

export type ListKingdomsQueryVariables = {
  filter?: ModelKingdomFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListKingdomsQuery = {
  listKingdoms?:  {
    __typename: "ModelKingdomConnection",
    items:  Array< {
      __typename: "Kingdom",
      ageStartTime?: string | null,
      buildings: string,
      createdAt?: string | null,
      currentAge?: KingdomCurrentAge | null,
      id: string,
      isActive?: boolean | null,
      isOnline?: boolean | null,
      lastActive?: string | null,
      name: string,
      owner?: string | null,
      race?: KingdomRace | null,
      resources: string,
      stats: string,
      totalUnits: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListTerritoriesQueryVariables = {
  filter?: ModelTerritoryFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListTerritoriesQuery = {
  listTerritories?:  {
    __typename: "ModelTerritoryConnection",
    items:  Array< {
      __typename: "Territory",
      buildings: string,
      coordinates: string,
      createdAt?: string | null,
      defenseLevel: number,
      id: string,
      kingdomId: string,
      name: string,
      owner?: string | null,
      resources: string,
      terrainType?: TerritoryTerrainType | null,
      type?: TerritoryType | null,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type CreateKingdomMutationVariables = {
  condition?: ModelKingdomConditionInput | null,
  input: CreateKingdomInput,
};

export type CreateKingdomMutation = {
  createKingdom?:  {
    __typename: "Kingdom",
    ageStartTime?: string | null,
    buildings: string,
    createdAt?: string | null,
    currentAge?: KingdomCurrentAge | null,
    id: string,
    isActive?: boolean | null,
    isOnline?: boolean | null,
    lastActive?: string | null,
    name: string,
    owner?: string | null,
    race?: KingdomRace | null,
    resources: string,
    stats: string,
    totalUnits: string,
    updatedAt: string,
  } | null,
};

export type CreateTerritoryMutationVariables = {
  condition?: ModelTerritoryConditionInput | null,
  input: CreateTerritoryInput,
};

export type CreateTerritoryMutation = {
  createTerritory?:  {
    __typename: "Territory",
    buildings: string,
    coordinates: string,
    createdAt?: string | null,
    defenseLevel: number,
    id: string,
    kingdomId: string,
    name: string,
    owner?: string | null,
    resources: string,
    terrainType?: TerritoryTerrainType | null,
    type?: TerritoryType | null,
    updatedAt?: string | null,
  } | null,
};

export type DeleteKingdomMutationVariables = {
  condition?: ModelKingdomConditionInput | null,
  input: DeleteKingdomInput,
};

export type DeleteKingdomMutation = {
  deleteKingdom?:  {
    __typename: "Kingdom",
    ageStartTime?: string | null,
    buildings: string,
    createdAt?: string | null,
    currentAge?: KingdomCurrentAge | null,
    id: string,
    isActive?: boolean | null,
    isOnline?: boolean | null,
    lastActive?: string | null,
    name: string,
    owner?: string | null,
    race?: KingdomRace | null,
    resources: string,
    stats: string,
    totalUnits: string,
    updatedAt: string,
  } | null,
};

export type DeleteTerritoryMutationVariables = {
  condition?: ModelTerritoryConditionInput | null,
  input: DeleteTerritoryInput,
};

export type DeleteTerritoryMutation = {
  deleteTerritory?:  {
    __typename: "Territory",
    buildings: string,
    coordinates: string,
    createdAt?: string | null,
    defenseLevel: number,
    id: string,
    kingdomId: string,
    name: string,
    owner?: string | null,
    resources: string,
    terrainType?: TerritoryTerrainType | null,
    type?: TerritoryType | null,
    updatedAt?: string | null,
  } | null,
};

export type UpdateKingdomMutationVariables = {
  condition?: ModelKingdomConditionInput | null,
  input: UpdateKingdomInput,
};

export type UpdateKingdomMutation = {
  updateKingdom?:  {
    __typename: "Kingdom",
    ageStartTime?: string | null,
    buildings: string,
    createdAt?: string | null,
    currentAge?: KingdomCurrentAge | null,
    id: string,
    isActive?: boolean | null,
    isOnline?: boolean | null,
    lastActive?: string | null,
    name: string,
    owner?: string | null,
    race?: KingdomRace | null,
    resources: string,
    stats: string,
    totalUnits: string,
    updatedAt: string,
  } | null,
};

export type UpdateTerritoryMutationVariables = {
  condition?: ModelTerritoryConditionInput | null,
  input: UpdateTerritoryInput,
};

export type UpdateTerritoryMutation = {
  updateTerritory?:  {
    __typename: "Territory",
    buildings: string,
    coordinates: string,
    createdAt?: string | null,
    defenseLevel: number,
    id: string,
    kingdomId: string,
    name: string,
    owner?: string | null,
    resources: string,
    terrainType?: TerritoryTerrainType | null,
    type?: TerritoryType | null,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateKingdomSubscriptionVariables = {
  filter?: ModelSubscriptionKingdomFilterInput | null,
  owner?: string | null,
};

export type OnCreateKingdomSubscription = {
  onCreateKingdom?:  {
    __typename: "Kingdom",
    ageStartTime?: string | null,
    buildings: string,
    createdAt?: string | null,
    currentAge?: KingdomCurrentAge | null,
    id: string,
    isActive?: boolean | null,
    isOnline?: boolean | null,
    lastActive?: string | null,
    name: string,
    owner?: string | null,
    race?: KingdomRace | null,
    resources: string,
    stats: string,
    totalUnits: string,
    updatedAt: string,
  } | null,
};

export type OnCreateTerritorySubscriptionVariables = {
  filter?: ModelSubscriptionTerritoryFilterInput | null,
  owner?: string | null,
};

export type OnCreateTerritorySubscription = {
  onCreateTerritory?:  {
    __typename: "Territory",
    buildings: string,
    coordinates: string,
    createdAt?: string | null,
    defenseLevel: number,
    id: string,
    kingdomId: string,
    name: string,
    owner?: string | null,
    resources: string,
    terrainType?: TerritoryTerrainType | null,
    type?: TerritoryType | null,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteKingdomSubscriptionVariables = {
  filter?: ModelSubscriptionKingdomFilterInput | null,
  owner?: string | null,
};

export type OnDeleteKingdomSubscription = {
  onDeleteKingdom?:  {
    __typename: "Kingdom",
    ageStartTime?: string | null,
    buildings: string,
    createdAt?: string | null,
    currentAge?: KingdomCurrentAge | null,
    id: string,
    isActive?: boolean | null,
    isOnline?: boolean | null,
    lastActive?: string | null,
    name: string,
    owner?: string | null,
    race?: KingdomRace | null,
    resources: string,
    stats: string,
    totalUnits: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteTerritorySubscriptionVariables = {
  filter?: ModelSubscriptionTerritoryFilterInput | null,
  owner?: string | null,
};

export type OnDeleteTerritorySubscription = {
  onDeleteTerritory?:  {
    __typename: "Territory",
    buildings: string,
    coordinates: string,
    createdAt?: string | null,
    defenseLevel: number,
    id: string,
    kingdomId: string,
    name: string,
    owner?: string | null,
    resources: string,
    terrainType?: TerritoryTerrainType | null,
    type?: TerritoryType | null,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateKingdomSubscriptionVariables = {
  filter?: ModelSubscriptionKingdomFilterInput | null,
  owner?: string | null,
};

export type OnUpdateKingdomSubscription = {
  onUpdateKingdom?:  {
    __typename: "Kingdom",
    ageStartTime?: string | null,
    buildings: string,
    createdAt?: string | null,
    currentAge?: KingdomCurrentAge | null,
    id: string,
    isActive?: boolean | null,
    isOnline?: boolean | null,
    lastActive?: string | null,
    name: string,
    owner?: string | null,
    race?: KingdomRace | null,
    resources: string,
    stats: string,
    totalUnits: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateTerritorySubscriptionVariables = {
  filter?: ModelSubscriptionTerritoryFilterInput | null,
  owner?: string | null,
};

export type OnUpdateTerritorySubscription = {
  onUpdateTerritory?:  {
    __typename: "Territory",
    buildings: string,
    coordinates: string,
    createdAt?: string | null,
    defenseLevel: number,
    id: string,
    kingdomId: string,
    name: string,
    owner?: string | null,
    resources: string,
    terrainType?: TerritoryTerrainType | null,
    type?: TerritoryType | null,
    updatedAt?: string | null,
  } | null,
};
