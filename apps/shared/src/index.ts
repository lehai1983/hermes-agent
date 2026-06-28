export {
  JsonRpcGatewayClient,
  type ConnectionState,
  type GatewayClientOptions,
  type GatewayEvent,
  type GatewayEventName,
  type GatewayRequestId,
  type JsonRpcFrame,
  type WebSocketLike
} from './json-rpc-gateway'

// Canonical shared types (identical across Web + Desktop)
export type {
  ActionStatusResponse,
  AnalyticsDailyEntry,
  AnalyticsModelEntry,
  AnalyticsSkillEntry,
  AnalyticsSkillsSummary,
  AuxiliaryModelsResponse,
  AuxiliaryTaskAssignment,
  LogsResponse,
  MessagingPlatformUpdate,
  MoaConfigResponse,
  MoaModelSlot,
  ModelOptionsResponse,
  OAuthPollResponse,
  OAuthProviderStatus,
  OAuthProvidersResponse,
  OAuthStartResponse,
  OAuthSubmitResponse,
  PlatformStatus,
  SessionMessagesResponse,
  SessionSearchResponse,
  SkillInfo,
  StaleAuxAssignment,
  ToolsetConfig,
  ToolsetInfo,
} from './types/core'

// Diverged shared types (referenced by clean types; desktop-superset shapes)
export type {
  ModelOptionProvider,
  OAuthProvider,
  SessionMessage,
  SessionSearchResult,
  ToolProvider,
} from './types/diverged'
