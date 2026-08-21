/**
 * app-categorizer.cjs
 *
 * Categorizes installed apps into profile-memory slots. Uses a large static
 * known-app map first. Apps that don't match are batched and sent to the
 * website API for AI classification. The AI can assign any slot name including
 * new dynamic ones (e.g. "emulator", "game_launcher", "screen_recorder").
 */
"use strict";

const { createLogger } = require("./logger.cjs");

const log = createLogger("AppCategorizer");

// ─── Known-App Map ───────────────────────────────────────────────────────────
// Keys are lowercase, stripped of punctuation/spaces for fuzzy matching.
// Each entry: { slot, display, importance }

const KNOWN_APP_MAP = [
  // ── Video Editors ──────────────────────────────────────────────────────────
  { pattern: /davinci[\s-]?resolve/i, slot: "video_editor", display: "DaVinci Resolve", importance: 9 },
  { pattern: /\badobe\s*premiere\b/i, slot: "video_editor", display: "Adobe Premiere Pro", importance: 9 },
  { pattern: /\bfinal\s*cut\b/i, slot: "video_editor", display: "Final Cut Pro", importance: 9 },
  { pattern: /\bcapcut\b/i, slot: "video_editor", display: "CapCut", importance: 7 },
  { pattern: /\bfilmora\b/i, slot: "video_editor", display: "Filmora", importance: 7 },
  { pattern: /\bvegas\s*pro\b/i, slot: "video_editor", display: "Vegas Pro", importance: 7 },
  { pattern: /\bkdenlive\b/i, slot: "video_editor", display: "Kdenlive", importance: 6 },
  { pattern: /\bshotcut\b/i, slot: "video_editor", display: "Shotcut", importance: 6 },
  { pattern: /\bhandbrake\b/i, slot: "video_editor", display: "HandBrake", importance: 6 },
  { pattern: /\biMovie\b/i, slot: "video_editor", display: "iMovie", importance: 7 },
  { pattern: /\bclipchamp\b/i, slot: "video_editor", display: "Clipchamp", importance: 6 },
  { pattern: /\bavisynth\b|\bvirtualdub\b/i, slot: "video_editor", display: "VirtualDub", importance: 5 },
  { pattern: /\bpowerDirector\b/i, slot: "video_editor", display: "PowerDirector", importance: 6 },
  { pattern: /\bcyberlink\s*powerdirector\b/i, slot: "video_editor", display: "PowerDirector", importance: 6 },
  { pattern: /\bafter\s*effects\b/i, slot: "video_editor", display: "Adobe After Effects", importance: 8 },

  // ── Code Editors ───────────────────────────────────────────────────────────
  { pattern: /\bvs\s*code\b|visual\s*studio\s*code|\bvscode\b/i, slot: "code_editor", display: "VS Code", importance: 9 },
  { pattern: /\bwebstorm\b/i, slot: "code_editor", display: "WebStorm", importance: 8 },
  { pattern: /\bintellij\b/i, slot: "code_editor", display: "IntelliJ IDEA", importance: 8 },
  { pattern: /\bpycharm\b/i, slot: "code_editor", display: "PyCharm", importance: 8 },
  { pattern: /\bsublime\s*text\b/i, slot: "code_editor", display: "Sublime Text", importance: 7 },
  { pattern: /\bnotepad\+\+\b/i, slot: "code_editor", display: "Notepad++", importance: 7 },
  { pattern: /\batom\b/i, slot: "code_editor", display: "Atom", importance: 6 },
  { pattern: /\bvim\b|\bgvim\b|\bneovim\b/i, slot: "code_editor", display: "Vim", importance: 7 },
  { pattern: /\bemacs\b/i, slot: "code_editor", display: "Emacs", importance: 7 },
  { pattern: /\beclipse\s*ide\b|\beclipse\b/i, slot: "code_editor", display: "Eclipse IDE", importance: 7 },
  { pattern: /\bnetbeans\b/i, slot: "code_editor", display: "NetBeans", importance: 6 },
  { pattern: /\bgoland\b/i, slot: "code_editor", display: "GoLand", importance: 7 },
  { pattern: /\bclion\b/i, slot: "code_editor", display: "CLion", importance: 7 },
  { pattern: /\brider\b/i, slot: "code_editor", display: "Rider", importance: 7 },
  { pattern: /\bxcode\b/i, slot: "code_editor", display: "Xcode", importance: 8 },
  { pattern: /\bvisual\s*studio\s*(\d{4}|community|professional|enterprise)/i, slot: "code_editor", display: "Visual Studio", importance: 8 },
  { pattern: /\bzed\b/i, slot: "code_editor", display: "Zed", importance: 7 },
  { pattern: /\bhex editor\b|\bhxd\b/i, slot: "code_editor", display: "HxD (Hex Editor)", importance: 5 },

  // ── AI Coding Assistants ───────────────────────────────────────────────────
  { pattern: /\bcodex\b/i, slot: "ai_coding_assistant", display: "Codex", importance: 9 },
  { pattern: /\bcursor\b/i, slot: "ai_coding_assistant", display: "Cursor", importance: 9 },
  { pattern: /\bgithub\s*copilot\b|\bcopilot\b/i, slot: "ai_coding_assistant", display: "GitHub Copilot", importance: 8 },
  { pattern: /\bclaude\s*code\b/i, slot: "ai_coding_assistant", display: "Claude Code", importance: 8 },
  { pattern: /\bcontinue\.dev\b|\bcontinue\s*dev\b/i, slot: "ai_coding_assistant", display: "Continue.dev", importance: 7 },
  { pattern: /\btabnine\b/i, slot: "ai_coding_assistant", display: "Tabnine", importance: 7 },
  { pattern: /\bjetbrains\s*ai\b/i, slot: "ai_coding_assistant", display: "JetBrains AI", importance: 7 },
  { pattern: /\bwindsurf\b/i, slot: "ai_coding_assistant", display: "Windsurf", importance: 8 },
  { pattern: /\bantigravity\b/i, slot: "ai_coding_assistant", display: "Antigravity", importance: 9 },
  { pattern: /\bcodeium\b/i, slot: "ai_coding_assistant", display: "Codeium", importance: 7 },
  { pattern: /\baider\b/i, slot: "ai_coding_assistant", display: "Aider", importance: 7 },

  // ── Design Software ─────────────────────────────────────────────────────────
  { pattern: /\bfigma\b/i, slot: "design_software", display: "Figma", importance: 8 },
  { pattern: /\bsketch\b/i, slot: "design_software", display: "Sketch", importance: 7 },
  { pattern: /\bphotoshop\b/i, slot: "design_software", display: "Adobe Photoshop", importance: 8 },
  { pattern: /\billustrator\b/i, slot: "design_software", display: "Adobe Illustrator", importance: 7 },
  { pattern: /\bcanva\b/i, slot: "design_software", display: "Canva", importance: 6 },
  { pattern: /\baffinity\s*(photo|designer|publisher)\b/i, slot: "design_software", display: "Affinity", importance: 7 },
  { pattern: /\binkscape\b/i, slot: "design_software", display: "Inkscape", importance: 6 },
  { pattern: /\bgimp\b/i, slot: "design_software", display: "GIMP", importance: 7 },
  { pattern: /\bblender\b/i, slot: "design_software", display: "Blender", importance: 8 },
  { pattern: /\bautocad\b/i, slot: "design_software", display: "AutoCAD", importance: 8 },
  { pattern: /\badobe\s*xd\b/i, slot: "design_software", display: "Adobe XD", importance: 7 },
  { pattern: /\blightroom\b/i, slot: "design_software", display: "Adobe Lightroom", importance: 7 },
  { pattern: /\bpaint\.net\b|\bpaintdotnet\b/i, slot: "design_software", display: "Paint.NET", importance: 6 },
  { pattern: /\bkrita\b/i, slot: "design_software", display: "Krita", importance: 6 },
  { pattern: /\bmaya\b/i, slot: "design_software", display: "Autodesk Maya", importance: 8 },
  { pattern: /\bcinema\s*4d\b|\bc4d\b/i, slot: "design_software", display: "Cinema 4D", importance: 8 },
  { pattern: /\bsketchup\b/i, slot: "design_software", display: "SketchUp", importance: 7 },
  { pattern: /\bmidjourney\b/i, slot: "design_software", display: "Midjourney", importance: 7 },
  { pattern: /\bstable\s*diffusion\b|\bautomatic1111\b|\bfooocus\b/i, slot: "design_software", display: "Stable Diffusion", importance: 7 },
  { pattern: /\bcorel\s*draw\b/i, slot: "design_software", display: "CorelDRAW", importance: 7 },

  // ── Communication ───────────────────────────────────────────────────────────
  { pattern: /\bslack\b/i, slot: "communication", display: "Slack", importance: 7 },
  { pattern: /\bmicrosoft\s*teams\b|^teams$/i, slot: "communication", display: "Microsoft Teams", importance: 7 },
  { pattern: /\bdiscord\b/i, slot: "communication", display: "Discord", importance: 7 },
  { pattern: /\bzoom\b/i, slot: "communication", display: "Zoom", importance: 7 },
  { pattern: /\bwhatsapp\b/i, slot: "communication", display: "WhatsApp", importance: 6 },
  { pattern: /\btelegram\b/i, slot: "communication", display: "Telegram", importance: 6 },
  { pattern: /\bsignal\b/i, slot: "communication", display: "Signal", importance: 6 },
  { pattern: /\bviber\b/i, slot: "communication", display: "Viber", importance: 5 },
  { pattern: /\bskype\b/i, slot: "communication", display: "Skype", importance: 6 },
  { pattern: /\bgoogle\s*meet\b|\bgmeet\b/i, slot: "communication", display: "Google Meet", importance: 6 },
  { pattern: /\bwebex\b/i, slot: "communication", display: "Cisco Webex", importance: 6 },
  { pattern: /\bline\b/i, slot: "communication", display: "LINE", importance: 5 },
  { pattern: /\bteamspeak\b/i, slot: "communication", display: "TeamSpeak", importance: 5 },
  { pattern: /\bmattermost\b/i, slot: "communication", display: "Mattermost", importance: 6 },
  { pattern: /\brocket\.chat\b/i, slot: "communication", display: "Rocket.Chat", importance: 5 },

  // ── Productivity ─────────────────────────────────────────────────────────────
  { pattern: /\bnotion\b/i, slot: "productivity", display: "Notion", importance: 8 },
  { pattern: /\bobsidian\b/i, slot: "productivity", display: "Obsidian", importance: 7 },
  { pattern: /\bgoogle\s*docs\b/i, slot: "productivity", display: "Google Docs", importance: 7 },
  { pattern: /\bmicrosoft\s*word\b|\bwinword\b/i, slot: "productivity", display: "Microsoft Word", importance: 6 },
  { pattern: /\bmicrosoft\s*excel\b|\bexcel\b/i, slot: "productivity", display: "Microsoft Excel", importance: 6 },
  { pattern: /\bgoogle\s*sheets\b/i, slot: "productivity", display: "Google Sheets", importance: 6 },
  { pattern: /\bairtable\b/i, slot: "productivity", display: "Airtable", importance: 6 },
  { pattern: /\btrello\b/i, slot: "productivity", display: "Trello", importance: 6 },
  { pattern: /\basana\b/i, slot: "productivity", display: "Asana", importance: 6 },
  { pattern: /\bjira\b/i, slot: "productivity", display: "Jira", importance: 7 },
  { pattern: /\blogseq\b/i, slot: "productivity", display: "Logseq", importance: 6 },
  { pattern: /\bclockify\b|\btoggl\b/i, slot: "productivity", display: "Time Tracker", importance: 5 },
  { pattern: /\btodolist\b|\btodoist\b/i, slot: "productivity", display: "Todoist", importance: 6 },
  { pattern: /\blibreoffice\b|\bopenoffice\b/i, slot: "productivity", display: "LibreOffice", importance: 6 },
  { pattern: /\blinear\b/i, slot: "productivity", display: "Linear", importance: 6 },
  { pattern: /\bconfluence\b/i, slot: "productivity", display: "Confluence", importance: 6 },
  { pattern: /\bclickup\b/i, slot: "productivity", display: "ClickUp", importance: 6 },
  { pattern: /\bmonday\.com\b/i, slot: "productivity", display: "Monday.com", importance: 6 },
  { pattern: /\bevernote\b/i, slot: "productivity", display: "Evernote", importance: 5 },
  { pattern: /\boneNote\b/i, slot: "productivity", display: "Microsoft OneNote", importance: 6 },

  // ── Browser ──────────────────────────────────────────────────────────────────
  { pattern: /\bgoogle\s*chrome\b|^chrome$/i, slot: "browser", display: "Google Chrome", importance: 7 },
  { pattern: /\bmicrosoft\s*edge\b|^edge$/i, slot: "browser", display: "Microsoft Edge", importance: 7 },
  { pattern: /\bmozilla\s*firefox\b|^firefox$/i, slot: "browser", display: "Firefox", importance: 7 },
  { pattern: /\bbrave\b/i, slot: "browser", display: "Brave", importance: 6 },
  { pattern: /\barc\s*browser\b|^arc$/i, slot: "browser", display: "Arc", importance: 6 },
  { pattern: /\bsafari\b/i, slot: "browser", display: "Safari", importance: 7 },
  { pattern: /\bopera\b/i, slot: "browser", display: "Opera", importance: 6 },
  { pattern: /\bvivaldi\b/i, slot: "browser", display: "Vivaldi", importance: 6 },
  { pattern: /\bthor\s*browser\b|\bzen\s*browser\b/i, slot: "browser", display: "Zen Browser", importance: 5 },

  // ── Terminal / Shell ──────────────────────────────────────────────────────────
  { pattern: /\bwindows\s*terminal\b/i, slot: "terminal", display: "Windows Terminal", importance: 7 },
  { pattern: /\bpowershell\b/i, slot: "terminal", display: "PowerShell", importance: 7 },
  { pattern: /\bcommand\s*prompt\b|^cmd$/i, slot: "terminal", display: "Command Prompt", importance: 6 },
  { pattern: /\biterm2?\b/i, slot: "terminal", display: "iTerm2", importance: 6 },
  { pattern: /\bwarp\b/i, slot: "terminal", display: "Warp", importance: 6 },
  { pattern: /\bgit\s*bash\b/i, slot: "terminal", display: "Git Bash", importance: 7 },
  { pattern: /\bmobaxterm\b/i, slot: "terminal", display: "MobaXterm", importance: 6 },
  { pattern: /\bputty\b/i, slot: "terminal", display: "PuTTY", importance: 6 },
  { pattern: /\balacritty\b/i, slot: "terminal", display: "Alacritty", importance: 6 },
  { pattern: /\bkitty\b/i, slot: "terminal", display: "Kitty", importance: 6 },
  { pattern: /\bhyper\b/i, slot: "terminal", display: "Hyper", importance: 5 },

  // ── Music / Audio ─────────────────────────────────────────────────────────────
  { pattern: /\bspotify\b/i, slot: "music_or_audio", display: "Spotify", importance: 6 },
  { pattern: /\bapple\s*music\b/i, slot: "music_or_audio", display: "Apple Music", importance: 6 },
  { pattern: /\baudacity\b/i, slot: "music_or_audio", display: "Audacity", importance: 7 },
  { pattern: /\badobe\s*audition\b/i, slot: "music_or_audio", display: "Adobe Audition", importance: 7 },
  { pattern: /\bfl\s*studio\b/i, slot: "music_or_audio", display: "FL Studio", importance: 7 },
  { pattern: /\bableton\b/i, slot: "music_or_audio", display: "Ableton Live", importance: 7 },
  { pattern: /\bfruity\s*loops\b/i, slot: "music_or_audio", display: "FL Studio", importance: 7 },
  { pattern: /\bgarageband\b/i, slot: "music_or_audio", display: "GarageBand", importance: 6 },
  { pattern: /\bdune\b|\breaper\b/i, slot: "music_or_audio", display: "REAPER", importance: 6 },
  { pattern: /\byoutube\s*music\b/i, slot: "music_or_audio", display: "YouTube Music", importance: 5 },
  { pattern: /\bdeezer\b|\btidal\b|\bqobuz\b/i, slot: "music_or_audio", display: "Music Streaming", importance: 5 },
  { pattern: /\bvoicemeeter\b/i, slot: "music_or_audio", display: "VoiceMeeter", importance: 6 },
  { pattern: /\beq\s*apo\b|\bpeacequality\b/i, slot: "music_or_audio", display: "Equalizer APO", importance: 5 },

  // ── Emulators ─────────────────────────────────────────────────────────────────
  { pattern: /\bbluestacks\b/i, slot: "emulator", display: "BlueStacks", importance: 7 },
  { pattern: /\bnox\s*player\b|\bnoxplayer\b/i, slot: "emulator", display: "NoxPlayer", importance: 6 },
  { pattern: /\bld\s*player\b|\bldplayer\b/i, slot: "emulator", display: "LDPlayer", importance: 6 },
  { pattern: /\bmemu\s*play\b|\bmemuplayer\b/i, slot: "emulator", display: "MEmu Play", importance: 6 },
  { pattern: /\bwinlator\b/i, slot: "emulator", display: "Winlator", importance: 5 },
  { pattern: /\bdolphin\s*emulator\b|\bdolphin\b/i, slot: "emulator", display: "Dolphin (GameCube/Wii)", importance: 6 },
  { pattern: /\brpcs3\b/i, slot: "emulator", display: "RPCS3 (PS3)", importance: 6 },
  { pattern: /\bcemu\b/i, slot: "emulator", display: "Cemu (Wii U)", importance: 6 },
  { pattern: /\bryujinx\b|\byuzu\b/i, slot: "emulator", display: "Nintendo Switch Emulator", importance: 6 },
  { pattern: /\bduck\s*station\b|\bduckstation\b/i, slot: "emulator", display: "DuckStation (PS1)", importance: 5 },
  { pattern: /\bpcsx2\b/i, slot: "emulator", display: "PCSX2 (PS2)", importance: 5 },
  { pattern: /\bproject64\b|\bmupen64\b/i, slot: "emulator", display: "N64 Emulator", importance: 5 },
  { pattern: /\bgenymotion\b/i, slot: "emulator", display: "Genymotion", importance: 6 },

  // ── Game Launchers ───────────────────────────────────────────────────────────
  { pattern: /\bsteam\b/i, slot: "game_launcher", display: "Steam", importance: 7 },
  { pattern: /\bepic\s*games\b/i, slot: "game_launcher", display: "Epic Games Launcher", importance: 7 },
  { pattern: /\bgog\s*galaxy\b/i, slot: "game_launcher", display: "GOG Galaxy", importance: 6 },
  { pattern: /\bea\s*(app|desktop|origin)\b|\borigin\b/i, slot: "game_launcher", display: "EA App", importance: 6 },
  { pattern: /\bubisoft\s*connect\b|\buplay\b/i, slot: "game_launcher", display: "Ubisoft Connect", importance: 6 },
  { pattern: /\bbattle\.net\b|\bblizzard\s*launcher\b/i, slot: "game_launcher", display: "Battle.net", importance: 6 },
  { pattern: /\bxbox\s*(app|game\s*pass)\b/i, slot: "game_launcher", display: "Xbox App", importance: 6 },
  { pattern: /\bitch\.io\b/i, slot: "game_launcher", display: "itch.io", importance: 5 },
  { pattern: /\bplaynite\b/i, slot: "game_launcher", display: "Playnite", importance: 5 },

  // ── Screen Recorders / Streaming ─────────────────────────────────────────────
  { pattern: /\bobs\s*(studio)?\b/i, slot: "screen_recorder", display: "OBS Studio", importance: 8 },
  { pattern: /\bbandicam\b/i, slot: "screen_recorder", display: "Bandicam", importance: 7 },
  { pattern: /\bfraps\b/i, slot: "screen_recorder", display: "Fraps", importance: 6 },
  { pattern: /\bnvidia\s*shadowplay\b|\bgeforce\s*experience\b/i, slot: "screen_recorder", display: "NVIDIA ShadowPlay", importance: 7 },
  { pattern: /\bxbox\s*game\s*bar\b/i, slot: "screen_recorder", display: "Xbox Game Bar", importance: 5 },
  { pattern: /\bloom\b/i, slot: "screen_recorder", display: "Loom", importance: 7 },
  { pattern: /\bsharefactory\b|\bscreencast\b/i, slot: "screen_recorder", display: "Screen Recorder", importance: 5 },
  { pattern: /\baction!\b/i, slot: "screen_recorder", display: "Action! Screen Recorder", importance: 6 },
  { pattern: /\bkap\b/i, slot: "screen_recorder", display: "Kap", importance: 5 },
  { pattern: /\bstreamlabs\b/i, slot: "screen_recorder", display: "Streamlabs", importance: 7 },
  { pattern: /\btwitch\s*studio\b/i, slot: "screen_recorder", display: "Twitch Studio", importance: 6 },

  // ── Media Players ────────────────────────────────────────────────────────────
  { pattern: /\bvlc\b/i, slot: "media_player", display: "VLC", importance: 7 },
  { pattern: /\bpotplayer\b/i, slot: "media_player", display: "PotPlayer", importance: 7 },
  { pattern: /\bmpc-hc\b|\bmpc\s*home\s*cinema\b/i, slot: "media_player", display: "MPC-HC", importance: 6 },
  { pattern: /\bmpc-be\b/i, slot: "media_player", display: "MPC-BE", importance: 6 },
  { pattern: /\bwindows\s*media\s*player\b/i, slot: "media_player", display: "Windows Media Player", importance: 5 },
  { pattern: /\bplex\b/i, slot: "media_player", display: "Plex", importance: 7 },
  { pattern: /\bkodi\b/i, slot: "media_player", display: "Kodi", importance: 6 },
  { pattern: /\binfuse\b/i, slot: "media_player", display: "Infuse", importance: 5 },
  { pattern: /\bjellyfin\b/i, slot: "media_player", display: "Jellyfin", importance: 6 },
  { pattern: /\bmpv\b/i, slot: "media_player", display: "MPV", importance: 6 },

  // ── File Utilities ───────────────────────────────────────────────────────────
  { pattern: /\b7-zip\b|^7zip$/i, slot: "file_utility", display: "7-Zip", importance: 7 },
  { pattern: /\bwinrar\b/i, slot: "file_utility", display: "WinRAR", importance: 7 },
  { pattern: /\bwinzip\b/i, slot: "file_utility", display: "WinZip", importance: 6 },
  { pattern: /\btotalcommander\b|\btotal\s*commander\b/i, slot: "file_utility", display: "Total Commander", importance: 6 },
  { pattern: /\bfree\s*commander\b|\bq-dir\b|\bdirectory\s*opus\b/i, slot: "file_utility", display: "File Manager", importance: 5 },
  { pattern: /\bteracopy\b/i, slot: "file_utility", display: "TeraCopy", importance: 5 },
  { pattern: /\bduplicati\b|\brobocopy\b/i, slot: "file_utility", display: "Backup Utility", importance: 5 },
  { pattern: /\bveracrypt\b|\bbitlocker\b/i, slot: "file_utility", display: "Encryption Tool", importance: 6 },

  // ── API / Dev Tools ──────────────────────────────────────────────────────────
  { pattern: /\bpostman\b/i, slot: "api_tool", display: "Postman", importance: 8 },
  { pattern: /\binsomnia\b/i, slot: "api_tool", display: "Insomnia", importance: 7 },
  { pattern: /\bhoppscotch\b/i, slot: "api_tool", display: "Hoppscotch", importance: 6 },
  { pattern: /\bthunderClient\b/i, slot: "api_tool", display: "Thunder Client", importance: 6 },
  { pattern: /\bcharles\b/i, slot: "api_tool", display: "Charles Proxy", importance: 6 },

  // ── DevOps Tools ─────────────────────────────────────────────────────────────
  { pattern: /\bdocker\s*(desktop)?\b/i, slot: "devops_tool", display: "Docker Desktop", importance: 8 },
  { pattern: /\bkubernetes\b|\bkubectl\b/i, slot: "devops_tool", display: "Kubernetes Tools", importance: 7 },
  { pattern: /\bvirtualbox\b/i, slot: "devops_tool", display: "VirtualBox", importance: 7 },
  { pattern: /\bvmware\b/i, slot: "devops_tool", display: "VMware", importance: 7 },
  { pattern: /\bhyper-v\b/i, slot: "devops_tool", display: "Hyper-V", importance: 6 },
  { pattern: /\bvagrant\b/i, slot: "devops_tool", display: "Vagrant", importance: 6 },
  { pattern: /\bterraform\b/i, slot: "devops_tool", display: "Terraform", importance: 7 },
  { pattern: /\bansible\b/i, slot: "devops_tool", display: "Ansible", importance: 7 },
  { pattern: /\bjenkins\b/i, slot: "devops_tool", display: "Jenkins", importance: 7 },

  // ── Cloud Storage ────────────────────────────────────────────────────────────
  { pattern: /\bgoogle\s*drive\b/i, slot: "cloud_storage", display: "Google Drive", importance: 6 },
  { pattern: /\bdropbox\b/i, slot: "cloud_storage", display: "Dropbox", importance: 6 },
  { pattern: /\bonedrive\b/i, slot: "cloud_storage", display: "OneDrive", importance: 6 },
  { pattern: /\bicloud\s*(for\s*windows)?\b/i, slot: "cloud_storage", display: "iCloud", importance: 6 },
  { pattern: /\bbox\b/i, slot: "cloud_storage", display: "Box", importance: 5 },
  { pattern: /\bpcloud\b/i, slot: "cloud_storage", display: "pCloud", importance: 5 },
  { pattern: /\bmega\b/i, slot: "cloud_storage", display: "MEGA", importance: 5 },

  // ── VPN / Security ───────────────────────────────────────────────────────────
  { pattern: /\bnordvpn\b/i, slot: "vpn_security", display: "NordVPN", importance: 6 },
  { pattern: /\bexpressvpn\b/i, slot: "vpn_security", display: "ExpressVPN", importance: 6 },
  { pattern: /\bsurfshark\b/i, slot: "vpn_security", display: "Surfshark", importance: 6 },
  { pattern: /\bprotonvpn\b/i, slot: "vpn_security", display: "ProtonVPN", importance: 6 },
  { pattern: /\bwireguard\b|\bopenvpn\b/i, slot: "vpn_security", display: "VPN Client", importance: 6 },
  { pattern: /\bbitdefender\b|\bkaspersky\b|\bmalwarebytes\b|\bavast\b|\bavg\b|\bnorton\b/i, slot: "vpn_security", display: "Antivirus", importance: 5 },

  // ── Database Tools ───────────────────────────────────────────────────────────
  { pattern: /\bdbeaver\b/i, slot: "database_tool", display: "DBeaver", importance: 7 },
  { pattern: /\btableplus\b/i, slot: "database_tool", display: "TablePlus", importance: 7 },
  { pattern: /\bdatagrip\b/i, slot: "database_tool", display: "DataGrip", importance: 7 },
  { pattern: /\bsequelpro\b|\bsequelace\b/i, slot: "database_tool", display: "Sequel Pro", importance: 6 },
  { pattern: /\bmongodb\s*compass\b/i, slot: "database_tool", display: "MongoDB Compass", importance: 6 },
  { pattern: /\bpgadmin\b/i, slot: "database_tool", display: "pgAdmin", importance: 6 },
  { pattern: /\bheidiSQL\b/i, slot: "database_tool", display: "HeidiSQL", importance: 6 },

  // ── Note-taking / Writing ─────────────────────────────────────────────────────
  { pattern: /\btypora\b/i, slot: "productivity", display: "Typora", importance: 6 },
  { pattern: /\bmarktext\b/i, slot: "productivity", display: "Mark Text", importance: 5 },
  { pattern: /\bscrivener\b/i, slot: "productivity", display: "Scrivener", importance: 6 },
  { pattern: /\bcraft\b/i, slot: "productivity", display: "Craft", importance: 6 },
];

// ─── Categorizer Logic ───────────────────────────────────────────────────────

/**
 * @param {string} appName
 * @returns {{ slot: string, display: string, importance: number } | null}
 */
function matchKnownApp(appName) {
  if (!appName) return null;
  const name = appName.trim();
  for (const entry of KNOWN_APP_MAP) {
    if (entry.pattern.test(name)) {
      return { slot: entry.slot, display: entry.display, importance: entry.importance };
    }
  }
  return null;
}

/**
 * Categorizes a list of installed apps using the static map.
 * Returns two lists: matched entries and unrecognized app names.
 *
 * @param {Array<{ name: string, publisher?: string, source: string }>} apps
 * @returns {{
 *   categorized: Array<{ slot: string, value: string, importance: number, source: string, tags: string[] }>,
 *   unrecognized: string[],
 * }}
 */
function categorizeWithStaticMap(apps) {
  const categorized = [];
  const unrecognized = [];

  for (const app of apps) {
    const match = matchKnownApp(app.name);
    if (match) {
      categorized.push({
        slot: match.slot,
        value: match.display,
        importance: match.importance,
        source: "desktop_scan",
        tags: ["desktop-scan", "known-software"],
      });
    } else {
      unrecognized.push(app.name);
    }
  }

  return { categorized, unrecognized };
}

/**
 * Sends unrecognized apps to the website API for AI classification.
 * Returns additional categorized entries for those it could classify.
 *
 * @param {string[]} appNames
 * @param {string} apiBaseUrl
 * @param {string} authToken
 * @returns {Promise<Array<{ slot: string, value: string, importance: number, source: string, tags: string[] }>>}
 */
async function classifyWithAI(appNames, apiBaseUrl, authToken) {
  if (!appNames.length) return [];

  // Batch in groups of 50 to stay within token limits
  const BATCH_SIZE = 50;
  const results = [];

  for (let i = 0; i < appNames.length; i += BATCH_SIZE) {
    const batch = appNames.slice(i, i + BATCH_SIZE);
    try {
      const url = `${apiBaseUrl}/api/desktop/classify-apps`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rearvy-desktop": "1",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ apps: batch }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        log.debug(`AI classification returned ${response.status} for batch starting at index ${i}`);
        continue;
      }

      const data = await response.json();
      const classifications = Array.isArray(data?.classifications) ? data.classifications : [];

      for (const cls of classifications) {
        if (!cls?.name || !cls?.slot) continue;
        // Validate slot name: lowercase snake_case, 1-64 chars
        if (!/^[a-z][a-z0-9_]{0,63}$/.test(cls.slot)) continue;
        results.push({
          slot: cls.slot,
          value: cls.displayName || cls.name,
          importance: typeof cls.importance === "number" ? cls.importance : 5,
          source: "desktop_scan",
          tags: ["desktop-scan", "ai-classified"],
        });
      }
    } catch (err) {
      log.debug(`AI classification batch ${i} failed:`, err?.message || err);
    }
  }

  return results;
}

/**
 * Full categorization pipeline:
 * 1. Static map matching
 * 2. AI classification for unrecognized apps (if apiBaseUrl provided)
 *
 * @param {Array<{ name: string, publisher?: string, source: string }>} apps
 * @param {{ apiBaseUrl?: string, authToken?: string }} options
 * @returns {Promise<Array<{ slot: string, value: string, importance: number, source: string, tags: string[] }>>}
 */
async function categorizeApps(apps, options = {}) {
  const { categorized, unrecognized } = categorizeWithStaticMap(apps);

  log.info(
    `Static map: ${categorized.length} matched, ${unrecognized.length} unrecognized`
  );

  let aiCategorized = [];
  if (unrecognized.length > 0 && options.apiBaseUrl) {
    log.info(`Sending ${unrecognized.length} apps to AI for classification...`);
    aiCategorized = await classifyWithAI(unrecognized, options.apiBaseUrl, options.authToken || "");
    log.info(`AI classified ${aiCategorized.length} additional apps`);
  }

  return [...categorized, ...aiCategorized];
}

module.exports = {
  categorizeApps,
  categorizeWithStaticMap,
  matchKnownApp,
  KNOWN_APP_MAP,
};
