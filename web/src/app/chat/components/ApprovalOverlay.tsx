/**
 * ApprovalOverlay — renders the active approval/clarify/sudo/secret prompt.
 *
 * Only one prompt can be active at a time (the backend serializes them via
 * _block). This component reads from the useApprovalEvents hook and renders
 * the matching modal.
 */

import { useApprovalEvents } from '../lib/useApprovalEvents'
import { ApprovalPrompt } from './ApprovalPrompt'
import { ClarifyPrompt } from './ClarifyPrompt'
import { SudoPrompt } from './SudoPrompt'
import { SecretPrompt } from './SecretPrompt'

export function ApprovalOverlay({ sessionId }: { sessionId?: string }) {
  const {
    approval,
    clarify,
    sudo,
    secret,
    respondApproval,
    respondClarify,
    respondSudo,
    respondSecret,
  } = useApprovalEvents(sessionId)

  if (approval) {
    return <ApprovalPrompt request={approval} onRespond={respondApproval} />
  }
  if (clarify) {
    return <ClarifyPrompt request={clarify} onRespond={respondClarify} />
  }
  if (sudo) {
    return <SudoPrompt request={sudo} onRespond={respondSudo} />
  }
  if (secret) {
    return <SecretPrompt request={secret} onRespond={respondSecret} />
  }
  return null
}
