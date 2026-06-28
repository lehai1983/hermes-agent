/**
 * Chat module — public API surface.
 *
 * This barrel re-exports the lib layer that desktop-lifted components
 * depend on. Components import from `@/app/chat` rather than reaching
 * into lib/ directly, so the internal structure can evolve without
 * breaking consumers.
 */

export { useGateway } from './lib/gateway'
export type { Result, UseGatewayOptions, UseGatewayReturn } from './lib/gateway'

export { useApprovalEvents } from './lib/useApprovalEvents'
export type {
  ApprovalRequest,
  ClarifyRequest,
  SudoRequest,
  SecretRequest,
  ApprovalState,
} from './lib/useApprovalEvents'

export { useEventStream } from './lib/sse'
export type {
  StreamStatus,
  UseEventStreamOptions,
  UseEventStreamReturn,
} from './lib/sse'

export {
  trackEvent,
  trackPageView,
  trackMessageSent,
  trackToolCalled,
  trackError,
} from './lib/analytics'

export { getFeatureFlags, isFeatureEnabled } from '@/lib/feature-flags'

export type {
  GatewayEvent,
  GatewayEventName,
  SessionInfo,
  SessionMessage,
  SkillInfo,
  ToolsetConfig,
} from './lib/types'

// Components
export { Thread, ThreadErrorBoundary } from './components/Thread'
export type { ThreadProps } from './components/Thread'

export { MessageItem } from './components/MessageItem'
export type { MessageItemProps } from './components/MessageItem'

export { ToolCallCard } from './components/ToolCallCard'
export type { ToolCallCardProps } from './components/ToolCallCard'

export { Composer, ComposerErrorBoundary } from './components/Composer'
export type { ComposerProps, ComposerAttachment } from './components/Composer'

export { ErrorBoundary, ThreadErrorBoundary as ErrorBoundaryThread, ComposerErrorBoundary as ErrorBoundaryComposer } from './components/ErrorBoundary'

export { VoiceControls } from './components/VoiceControls'
export type { VoiceControlsProps } from './components/VoiceControls'

export { WelcomeScreen } from './components/WelcomeScreen'
export type { WelcomeScreenProps } from './components/WelcomeScreen'

// Panels (right-rail)
export { RightRail } from './panels/RightRail'
export type { RightRailProps } from './panels/RightRail'

export { TerminalPane } from './panels/TerminalPane'
export type { TerminalPaneProps } from './panels/TerminalPane'

export { PreviewPane } from './panels/PreviewPane'
export type { PreviewPaneProps } from './panels/PreviewPane'

export { GitReviewPane } from './panels/ReviewPane'
export type { GitReviewPaneProps } from './panels/ReviewPane'

// Approval prompts
export { ApprovalOverlay } from './components/ApprovalOverlay'
export { ApprovalPrompt } from './components/ApprovalPrompt'
export { ClarifyPrompt } from './components/ClarifyPrompt'
export { SudoPrompt } from './components/SudoPrompt'
export { SecretPrompt } from './components/SecretPrompt'
