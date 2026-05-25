# Rearvy Feature Status Messages

## For the App to Show Users

### When Terminal Features Are Limited

**Show this to users when they first open the app or try to use Terminal:**

---

### 📢 Limited Mode Active

You're using Rearvy, but **not at full power**. 

**Terminal, automation, and device features require a quick setup:**

1. Open your terminal
2. Run 3 commands
3. Unlock full Rearvy

[📖 Learn More & Setup](./UNLOCK_FULL_REARVY.md)

---

### When Terminal Features ARE Available

**Show this after full setup is complete:**

---

### ✅ Full Rearvy Unlocked

All features are now available:
- ✅ Terminal commands
- ✅ AI automation
- ✅ Device access
- ✅ Screen capture
- ✅ Advanced integrations

Enjoy the full power of Rearvy! 🚀

---

## Suggested UI Placements

1. **Banner at top of app** (when in limited mode)
   - "⚠️ You're using Rearvy in limited mode. [Unlock Full Features →]"
   
2. **Terminal Agent card** (when Terminal unavailable)
   - "Terminal Agent requires setup. [See how →]"
   
3. **Onboarding/First-time flow**
   - "To access AI Terminal and automation, you need to run a quick setup"
   - Link to UNLOCK_FULL_REARVY.md

4. **Help menu**
   - "Why can't I use Terminal?" → Link to UNLOCK_FULL_REARVY.md
   - "How do I enable full features?" → Link to UNLOCK_FULL_REARVY.md

---

## Copy for AI to Use When Responding to Users

### When user asks about Terminal or Automation

> You need to unlock Rearvy's full features to use Terminal and automation. 
> 
> **[Read this guide →](./UNLOCK_FULL_REARVY.md)** It explains what you're missing and how to set it up in 3 simple commands (takes ~5 minutes).

### When user says features aren't working

> Your Rearvy is in limited mode. Some features like Terminal and device access require a local backend setup.
>
> **[Click here to unlock full features →](./UNLOCK_FULL_REARVY.md)**

### When Terminal shows "Connecting..."

> Terminal is waiting for the backend server. If you haven't run the setup yet:
>
> **[Follow this quick setup guide →](./UNLOCK_FULL_REARVY.md)**
>
> Once running, Terminal Agent will be available immediately.

### When Work Platform local actions are unavailable

> Work Platform agents, schedules, channels, sources, and run history are active.
> Browser-use, terminal/file tools, stdio MCP, and desktop workflows need full
> local mode. Run `npm run dev:both` or pair a desktop device from `/work/channels`.
> Public source research fallback and outbound channel sends stay approval-gated.
