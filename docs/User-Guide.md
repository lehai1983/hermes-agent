# Hermes Web Chat — User Guide

Welcome to Hermes Web Chat! This guide will help you get started with the browser-based interface for interacting with Hermes AI.

---

## Getting Started

### Starting the Web Chat

To launch Hermes Web Chat, run one of the following commands in your terminal:

```bash
# Option 1: Dashboard launcher (recommended)
hermes dashboard

# Option 2: Direct gateway start
hermes gateway run
```

Once the gateway is running, open your browser and navigate to:

```
http://localhost:18080
```

You should see the Hermes Web Chat interface load, ready for your first message.

---

## Web Chat Interface

### Thread (Main Conversation Area)

The **Thread** is the central area where your conversation with Hermes takes place.

- **Markdown Rendering** — All messages support Markdown formatting including:
  - Code blocks with syntax highlighting
  - **Bold**, *italic*, and ~~strikethrough~~ text
  - Links, lists, and blockquotes
- **Streaming Responses** — Watch Hermes think in real time with a caret animation (▌) as responses are generated token by token.
- **Tool Call Cards** — When Hermes uses tools (running commands, searching files, etc.), you'll see expandable cards showing:
  - 🔄 **Running** — Tool is currently executing
  - ✅ **Success** — Tool completed successfully
  - ❌ **Error** — Tool encountered an error

### Composer (Message Input)

The **Composer** is the rich-text input area at the bottom of the screen where you type your messages.

- **Formatting Toolbar** — Apply formatting without leaving the keyboard:
  - **Bold** — `Ctrl+B`
  - *Italic* — `Ctrl+I`
  - `Inline Code` — `` Ctrl+` ``
- **Send & Newline** — Press `Enter` to send your message. Press `Shift+Enter` to insert a new line.
  - **File Attachments** — Drag and drop files directly onto the composer to attach them to your message.
- **Voice Controls** — Click the microphone button to toggle voice input (speech-to-text).

### Inline Editing

Made a mistake or want to rephrase something? Click the **pencil icon** (✏️) on any of your previous messages to:

1. Edit the message content inline
2. Resend it to get a fresh response

This lets you branch off from any point in the conversation without starting over.

### Error Recovery

If something goes wrong (a component crashes or fails to load), Hermes Web Chat has **automatic error boundaries** that catch the problem and display a friendly **Reload** button. Click it to restore the interface without losing your session context.

---

## Right-Rail Panels

On the right side of the interface, you'll find additional panels depending on your configuration:

- **Terminal** — A browser-based terminal for running shell commands directly within the web interface.
- **Preview** — Renders live previews of HTML, markdown, or other content Hermes generates.
- **Git Review** — Shows git diffs and allows reviewing changes before applying them.

These panels can be toggled on and off as needed.

---

## Feature Flags (URL Parameters)

Customize your experience by adding parameters to the URL:

| Parameter | Effect |
|-----------|--------|
| `?embed=1` | Minimal mode — hides sidebar, voice controls, and pet overlay |
| `?debug=1` | Shows debug information for troubleshooting |
| `?voice=0` | Disables voice input controls |
| `?pet=0` | Disables the animated pet overlay |
| `?analytics=0` | Disables analytics tracking |

**Example:**

```
http://localhost:18080/?embed=1&pet=0
```

You can combine multiple flags using `&`.

---

## Approval Prompts

When Hermes needs permission to perform an action (such as running a sensitive command or accessing credentials), an **approval prompt** will appear. You'll see options like:

- **Approve** — Allow the action to proceed
- **Clarify** — Ask Hermes to provide more information first
- **Sudo** — Grant elevated permissions for this action
- **Secret** — Provide a secret or credential needed for the operation

Review each prompt carefully before approving, especially for actions that modify files or run system commands.

---

## Pet System

By default, Hermes includes an **animated pet overlay** in the corner of the interface — a friendly companion that reacts to the conversation.

- The pet provides visual feedback during long-running operations
- It can be interacted with for fun animations
- To disable it, add `?pet=0` to your URL or toggle it in settings

---

## Migration from Desktop

Hermes Web Chat replaces the previous Electron-based desktop application. Here's what's changed:

| Feature | Desktop (Legacy) | Web Chat |
|---------|-----------------|----------|
| **Installation** | Download & install app | Just open a browser |
| **Updates** | Auto-updater required | Always up-to-date |
| **File Encryption** | Local safeStorage | Handled server-side |
| **Popout Windows** | Native window popouts | Use browser tabs |
| **Terminal** | node-pty (native) | Browser-based terminal |
| **Platform** | macOS, Windows, Linux | Any modern browser |

### Key Differences

- **No local file encryption** — Encryption is now handled server-side. Your data is protected in transit and at rest by the gateway.
- **No native popout windows** — Use your browser's tab system to open multiple conversations side by side.
- **Always up-to-date** — Since the interface is served by the gateway, you always get the latest version without manual updates.
- **Browser-based terminal** — The terminal runs in your browser instead of using native node-pty, providing a consistent experience across platforms.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | Insert new line |
| `Ctrl+B` | Bold text |
| `Ctrl+I` | Italic text |
| `` Ctrl+` `` | Inline code |

---

## Troubleshooting

### Connection Errors

**Symptom:** "Failed to connect" or similar error message.

**Solution:** Make sure the Hermes gateway is running:

```bash
hermes gateway run
```

Verify that port `18080` is accessible on your machine.

### White Screen

**Symptom:** The page loads but shows a blank white screen.

**Solution:**
1. Open your browser's developer tools (F12) and check the Console tab for errors
2. Try a hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
3. Clear your browser cache and reload

### SSE Not Streaming

**Symptom:** Messages appear all at once instead of streaming in real time.

**Solution:**
1. Verify the gateway is running: `hermes gateway run`
2. Check that port `18080` is not blocked by a firewall
3. Try a different browser (Chrome or Firefox recommended)
4. Disable any browser extensions that might interfere with network requests

### Voice Input Not Working

**Symptom:** Microphone button doesn't respond or gives an error.

**Solution:**
1. Ensure your browser has permission to access your microphone
2. Check that `?voice=0` is not set in your URL
3. Try using a different browser (Chrome has the best Web Speech API support)

---

## Need More Help?

- Check the [Architecture Documentation](./Architecture.md) for technical details
- Visit the project repository for issue reporting and contributions
- Run `hermes --help` in your terminal for command-line options
